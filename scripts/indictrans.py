#!/usr/bin/env python3
"""IndicTrans2 (AI4Bharat) worker for scripts/build-translations.js.  Usage: indictrans.py <lang> <in.json> <out.json>
Reads a JSON list of English strings, writes {english: translation}. Resumable: strings already in out.json are skipped."""
import json, os, re, sys, unicodedata

CODES = {'hi': 'hin_Deva', 'ml': 'mal_Mlym', 'pa': 'pan_Guru', 'as': 'asm_Beng', 'gu': 'guj_Gujr', 'kn': 'kan_Knda',
         'or': 'ory_Orya', 'ta': 'tam_Taml', 'te': 'tel_Telu', 'bn': 'ben_Beng', 'mr': 'mar_Deva'}

def to_num(t):      # {1} -> 7001 : models copy numbers far more reliably than braces
    return re.sub(r'\{(\d+)\}', lambda m: str(7000 + int(m.group(1))), t)

def from_num(t):    # native digits -> ascii, then 7001 -> {1}
    t = ''.join(str(unicodedata.decimal(c)) if unicodedata.decimal(c, None) is not None else c for c in t)
    return re.sub(r'(?<!\d)70(\d\d)(?!\d)', lambda m: '{%d}' % int(m.group(1)), t)

def load_model(tgt):
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    try:
        from IndicTransToolkit.processor import IndicProcessor
    except ImportError:
        from IndicTransToolkit import IndicProcessor
    name = os.environ.get('INDICTRANS_MODEL', 'ai4bharat/indictrans2-en-indic-dist-200M')
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'  loading {name} on {dev} (first run downloads the model)...', flush=True)
    tok = AutoTokenizer.from_pretrained(name, trust_remote_code=True)
    kw = {'torch_dtype': torch.float16} if dev == 'cuda' else {}
    model = AutoModelForSeq2SeqLM.from_pretrained(name, trust_remote_code=True, **kw).to(dev).eval()
    ip = IndicProcessor(inference=True)
    beams = int(os.environ.get('INDICTRANS_BEAMS', '4'))
    def run(batch):
        pre = ip.preprocess_batch(batch, src_lang='eng_Latn', tgt_lang=tgt)
        enc = tok(pre, truncation=True, padding='longest', return_tensors='pt', return_attention_mask=True).to(dev)
        with torch.no_grad():
            gen = model.generate(**enc, use_cache=True, min_length=0, max_length=320, num_beams=beams, num_return_sequences=1)
        with tok.as_target_tokenizer():
            dec = tok.batch_decode(gen.detach().cpu().tolist(), skip_special_tokens=True, clean_up_tokenization_spaces=True)
        return ip.postprocess_batch(dec, lang=tgt)
    return run

def main():
    lang, src, dst = sys.argv[1:4]
    texts = json.load(open(src, encoding='utf-8'))
    out = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else {}
    todo = sorted([t for t in texts if t not in out], key=len)
    if not todo:
        return
    if os.environ.get('INDICTRANS_DRYRUN'):          # test hook: no model, fake output
        run = lambda b: ['अ' + x for x in b]
    else:
        run = load_model(CODES[lang])
    size = int(os.environ.get('INDICTRANS_BATCH', '16'))
    for i in range(0, len(todo), size):
        part = todo[i:i + size]
        for t, r in zip(part, run([to_num(x) for x in part])):
            out[t] = from_num(r)
        json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'  {lang}: {min(i + size, len(todo))}/{len(todo)}', flush=True)

if __name__ == '__main__':
    main()
