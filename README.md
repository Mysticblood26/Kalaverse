# KalaVerse website

A website for learning Indian traditional art, with a KalaSathi chatbot that uses a free LLM API.
No npm packages are needed. You only need Node.js 18 or newer.

## Run it

1. Copy `.env.example` to `.env`.
2. Add ONE key (see below).
3. Run `node server.js` (or `npm start`) and open http://localhost:3000

Without a key the site still works. KalaSathi then answers from the built-in heritage notes.

## Getting a free API key

**OpenRouter (recommended)**
1. Sign up at https://openrouter.ai and create a key at https://openrouter.ai/keys
2. Put it in `.env` as `OPENROUTER_API_KEY=...`
3. `OPENROUTER_MODEL` is a comma separated list tried in order. The default is Gemma 4 31B, then Nemotron 3 Super,
   then the `openrouter/free` router. Free ids are removed without notice, so keep two or three in the list and
   check https://openrouter.ai/models?max_price=0 once a month.
4. Free limits: 20 requests per minute, and 50 requests per day for the whole account until you have bought at least
   USD 10 of credits (then 1,000 per day). Before a demo or hackathon judging, a one-time USD 10 top-up is worth it.
   When the limit is hit, KalaSathi automatically answers from the offline notes.
5. Some free hosts may train on prompts. Gemma 4 on Google AI Studio does not train on them, which is why it is first.
   Tell users not to type personal information into the chat.

**Hugging Face (not recommended)**
A free Hugging Face account gets about USD 0.10 of Inference Providers credit per month, which is only a handful of chats.
Use it only for a quick test: put `HF_TOKEN=...` in `.env` and set `LLM_PROVIDER=huggingface`.

Free models can be slow, rate limited, or removed without notice.

## Why a server and not just a script in the page

A key placed in browser JavaScript can be copied by anyone who opens the page. Here the key stays in `.env` on the
server. The browser only talks to `/api/chat`. The server also limits requests per visitor (`RATE_LIMIT_PER_MIN`),
caps message length, sends a strict Content-Security-Policy, and never serves `.env` or `server.js`.
Behind a hosting proxy set `TRUST_PROXY=1` so each visitor gets their own limit.

## Dataset

No external dataset is required. The heritage dataset is `public/data/heritage.json` (all 36 states and union territories, plus 5 one-day
tours, taken from the KalaVerse app data). KalaSathi retrieves the matching art form from this file and passes it to the
model as verified notes, so answers stay grounded. To add an art form, add an entry in the same format and add its
keyword to `NAMED` in `public/js/core.js`.

## How KalaSathi works

1. The message is classified: art question, follow-up, unrelated, inappropriate or unclear.
2. Unrelated, inappropriate and unclear messages get a fixed reply and the model is not called.
3. Art questions and follow-ups go to the model with the matching heritage notes and a short-answer instruction.
4. The reply streams to the page as it is generated, with a typing cursor. Bold text and lists in the reply are shown as
   formatting (built from text, never as HTML). After an art answer, buttons offer the next question.
5. If a model rejects the system instruction (HTTP 400), the server retries it with the instructions folded into the question.

## Files

- `server.js` web server, API proxy, rate limit
- `public/index.html` page structure
- `public/css/style.css` all styling
- `public/js/core.js` intent detection and offline answers (shared by browser and server)
- `public/js/chat.js` KalaSathi chat and streaming
- `public/js/features.js` cultural map, KalaLens, KalaTour planner (group type, summary, copy plan, surprise me), Community (marketplace sort/saved/enquire, workshops filters and requests, showcase with sample posts)
- `public/js/app.js` navigation, home, Explore India (search, region filter, deep links like `#explore/bihar`), KalaTour
- `public/data/heritage.json` dataset

## Deploying

Any host that runs Node (Render, Railway, a VPS) works. Set the same variables in the host's environment settings
instead of uploading `.env`. A static-only host (GitHub Pages, plain Netlify) cannot run the chatbot safely.

## Feature notes

- **Language and theme**: header buttons switch English / Hindi and dark / light (saved in the browser). Menus, headings, labels and KalaSathi follow the language. Hindi art-form notes are read from `public/data/heritage.hi.json` (currently Bihar; other states show English until added). With an API key KalaSathi answers in the chosen language.
- **KalaLens**: with the list on *Auto-detect* (default) the picture is first sent to Google Gemini (native API, structured JSON output, temperature 0, art catalogue in the prompt) which names the art form and shows its confidence plus runner-ups. If it is not sure, the page asks you to confirm. Then the mentor feedback is written for that art form. Needs `GEMINI_API_KEY`. Optional `GEMINI_DETECT_MODEL` (comma list, tried in order; unknown models are skipped). Detection is very good on the 36 forms in the dataset but never 100%, hence the confirm buttons.
- **Book tickets (demo)**: page `#book`. KalaYatri (chat plan, with a Travellers box) and KalaTour (day plan or curated trail, with a travellers box) both open it. Fake tickets and a FAKE payment portal that accepts only the demo card `4242 4242 4242 4242` (`4000 0000 0000 0002` shows a decline), UPI `demo@kalaverse` or the demo bank. Nothing is charged, card details are never stored, tickets are marked DEMO. Bookings stay in the browser (`kv_bookings`).
- **Community pictures**: every sample post has an image in `public/img/community/` (named after the poster: `Anita.jfif`, `Rohan.jfif`, `Meera.jfif`, `Kabir.jfif`, `Lakshmi.jfif`, `Tenzin.jfif`, plus `placeholder.jfif`). Replace the files keeping the same names, or edit the `img` paths in `SAMPLES` in `public/js/features.js`. Visitors can attach a picture to their own post.
- **KalaTour planner / KalaYatri**: built from `heritage.json`. No live timetables, and booking requests are saved locally only.
- **Marketplace / Showcase**: sample listings from the dataset; posts and wishlist use localStorage. Real sellers, payments and shared posts need a backend.

## Map

The map is drawn from `public/data/map.json` (state outlines taken from a Simplemaps India SVG, free for commercial use, https://simplemaps.com). Click a state or use the dropdown.

## Languages (12) and translation (permanent, pre-built)

The menu has English, Hindi, Malayalam, Punjabi, Assamese, Gujarati, Kannada, Odia, Tamil, Telugu, Bengali and Marathi.

**No translation API is called while people use the site.** Every sentence on every page is translated ONCE, ahead of time, and stored
in `public/data/i18n/<lang>.json`. The browser (`public/js/translate.js`) just looks the text up in that file, so it is instant, free,
works offline and can never be rate limited. The AI key is used only by **KalaSathi**, **KalaYatri** and **KalaLens**
(they answer in the chosen language).

### Build or refresh the translation files (one time, on your computer)

Easiest way (free, about 15 minutes, no Python or model download):

1. Get a free Gemini key at https://aistudio.google.com/apikey (no credit card) and put it in `.env` as `GEMINI_API_KEY=...`
2. Run `npm run translate` (all 11 languages) or `npm run translate -- ta te bn` (only some).

The script reads `.env` itself and tries providers in this order, using only the ones whose key is set:

| Provider | Key in `.env` | Cost |
| --- | --- | --- |
| Gemini (Flash-Lite) | `GEMINI_API_KEY` | free tier, about 500 requests per day, the whole site needs about 50 per language |
| Google Cloud Translation | `GOOGLE_TRANSLATE_API_KEY` | first 500,000 characters per month free (the site is about 78,000 characters per language) |
| Sarvam AI (`sarvam-translate:v1`) | `SARVAM_API_KEY` | Rs 100 free credit, about 50,000 characters, so less than one language |
| Google web translate | none | free but slow, blocked when rate limited |

Force one provider with `TRANSLATE_ENGINE=gemini` (or `google-cloud`, `sarvam`, `web`). The free Gemini tier may let Google use the
text you send; that is fine here because it is only the public site text.

It is resumable: finished strings are kept in `cache/`, so you can stop (or hit a daily limit) and run again later.
`npm run translate:rebuild` rewrites `public/data/i18n/*.json` from `cache/` without calling any API.

**Optional offline engine, IndicTrans2** (AI4Bharat, runs on your own computer, no key, but about 2 GB download and a C compiler):
`TRANSLATE_ENGINE=indictrans npm run translate`. Setup:

    python -m venv .venv  &&  source .venv/bin/activate      (Windows: .venv\\Scripts\\activate)
    pip install -r scripts/requirements-indic.txt

- If Hugging Face asks you to accept the model terms, do it once and run `huggingface-cli login`.
- Uses the small 200M model by default. For better quality set `INDICTRANS_MODEL=ai4bharat/indictrans2-en-indic-1B`.
- If you get an error about `trust_remote_code` or the tokenizer, install an older transformers (for example `pip install "transformers<4.50"`).
- A few strings may fail the safety checks (a `{1}` token was lost, or the text stayed English). Fill just those with `npm run translate -- hi`
  using one of the API providers above.

Then **commit `public/data/i18n/` and `cache/`** so every deploy ships them (Render's free disk is wiped on each deploy).

What it translates: all art forms, states, crafts, history, tutorials and tours in `heritage.json`; menus and labels; `index.html`;
text written in the scripts; and the sentences the site builds from pieces (planner, marketplace, workshops, KalaLens feedback, titles).
Numbers and names inside sentences are replaced by `{1}`, `{2}` tokens, so "Sample price Rs 5,300" and "Sample price Rs 7,500" share one
stored sentence, and state / art names are written in the reader's own script.
If you add new text to the code, run `npm run translate` again. Anything not yet translated simply stays in English.

Hindi for Bihar in `heritage.hi.json` is hand-written and is kept as is.
Changing language now reloads the page, so nothing is left half translated.

- **Marketplace cart**: every listing has Add to cart and Buy now. The `Cart` link (header) opens `#cart`: change quantities, delivery details, the same fake payment portal as ticket booking, then a demo order page. Delivery is Rs 99, free above Rs 3,000 (sample). Marketplace pictures go in `public/img/market/` (one `.jfif` per state, named after its main art form exactly as shown on the card, with any `/` removed, e.g. `Madhubani Mithila Painting.jfif`; fallback `market-placeholder.jfif`).
