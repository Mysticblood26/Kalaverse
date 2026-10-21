/* KalaVerse: theme (dark/light) and language (English, Hindi). Loaded in <head> so the theme is set before first paint. */
(function () {
  const KEY = (k) => 'kv_' + k;
  const get = (k) => { try { return localStorage.getItem(KEY(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(KEY(k), v); } catch (e) { /* storage blocked */ } };
  const root = document.documentElement;

  const LANGS = ['en', 'hi', 'ml', 'pa', 'as', 'gu', 'kn', 'or', 'ta', 'te', 'bn', 'mr'];
  const D = {
    en: {
      'nav.home': 'Home', 'nav.explore': 'Explore India', 'nav.map': 'Map', 'nav.kalasathi': 'KalaSathi', 'nav.lens': 'KalaLens', 'nav.tours': 'KalaTour', 'nav.yatri': 'KalaYatri', 'nav.community': 'Community',
      'theme.dark': 'Dark mode', 'theme.light': 'Light mode', 'lang.label': 'Language',
      'home.h1': 'Learn Indian traditional art, one state at a time.',
      'home.lede': 'KalaVerse is a platform for learning folk paintings and crafts, asking an AI guide questions about them, and planning a day around the artisans who keep them alive.',
      'home.explore': 'Explore India', 'home.ask': 'Ask KalaSathi', 'home.start': 'Start with an art form',
      'home.r1': 'Regional art forms with their history, cultural meaning, materials, motifs and a short tutorial for each.',
      'home.r2': 'Ask about an art form, a technique or a material and get a short answer. Follow-up questions stay on the same art form.',
      'home.r3': 'One-day cultural itineraries built around artisan villages, workshops and local food.',
      'home.r4': 'Upload your artwork for colour, balance and detail feedback tied to the art form you are practising.',
      'home.r5': 'Travel concierge for routes, accessibility and workshop booking requests.',
      'home.r6': 'Artist showcase, marketplace and workshops.',
      'explore.h': 'Explore India', 'explore.search': 'Search art form or state', 'explore.all': 'All regions',
      'map.h': 'Cultural map of India', 'map.sub': 'Click or tap any state or union territory (all 36) to discover its art form, crafts, tours and marketplace.', 'map.pick': 'Choose a state or union territory', 'map.fail': 'The map could not be loaded. Use the dropdown above.',
      'tours.h': 'KalaTour', 'tours.sub': 'Build a personalised one-day cultural itinerary, or browse the curated trails below.', 'tours.curated': 'Curated trails',
      'lens.sub': 'Upload a photo of your artwork. Scores are worked out in your browser. For mentor feedback, a small copy of the image is sent to the AI model and is not stored on this site.',
      'yatri.sub': 'Travel concierge for cultural trips: routes, accessibility checks and workshop booking requests.',
      'comm.h': 'Community and Marketplace', 'comm.sub': 'Sample listings built from the KalaVerse dataset to show how the marketplace works. Payments and real seller accounts are not enabled on this site.',
      'ex.state': 'State', 'ex.capital': 'Capital', 'ex.region': 'Region', 'ex.ask': 'Ask KalaSathi about ', 'ex.history': 'History', 'ex.sig': 'Cultural significance', 'ex.good': 'Good to know', 'ex.mat': 'Traditional materials', 'ex.motifs': 'Key motifs', 'ex.other': 'Other crafts from ', 'ex.try': 'Try it: ', 'ex.need': 'You will need', 'ex.about': 'about',
      'ex.count': ' art traditions', 'ex.of': ' of ', 'ex.shown': ' shown.', 'ex.empty': 'No art form matches. Try a different word or choose All regions.',
      'map.art': 'Art and craft to discover', 'map.places': 'Places and experiences', 'map.none': 'No curated one-day trail yet. Build your own with the planner.', 'map.learn': 'Learn more', 'map.plan': 'Plan a day here', 'map.shop': 'Browse marketplace', 'map.ask': 'Ask KalaSathi',
      'tips': 'Practical tips',
      'zone.North': 'North', 'zone.South': 'South', 'zone.East': 'East', 'zone.West': 'West', 'zone.Central': 'Central', 'zone.NorthEast': 'North East', 'zone.Islands': 'Islands',
      'chat.sub': 'Your guide to Indian arts and crafts', 'chat.ph': 'Ask about an art form, materials, history or how to try it', 'chat.send': 'Send', 'chat.new': 'New chat',
      'chat.hello': 'Namaste! I am KalaSathi. Ask me about an Indian art form, for example "Explain Madhubani painting" or "What materials are used in Pattachitra?".',
      'chat.q1': 'Explain Madhubani painting', 'chat.q2': 'How do I make a Warli painting?', 'chat.q3': 'What materials are used in Pattachitra?', 'chat.q4': 'What is the cultural significance of Warli painting?',
      'chat.n1': 'Materials', 'chat.n2': 'History', 'chat.n3': 'Why it matters', 'chat.n4': 'How to try it',
      'chat.nq1': 'What materials are used?', 'chat.nq2': 'Tell me its history', 'chat.nq3': 'Why is it significant?', 'chat.nq4': 'How do I make it?',
            'chat.off': 'Offline mode: answers come from the built-in heritage notes (in English). Add an API key on the server to enable the AI model.',
      'chat.nofetch': 'Offline mode: the chat server is not reachable, so answers come from the built-in heritage notes (in English).',
      'chat.fallback': 'The AI model could not be reached, so this answer came from the built-in heritage notes.',
      'chat.rate': 'Too many questions in a short time. Please wait a minute and try again.', 'chat.typing': 'KalaSathi is typing', 'chat.you': 'You', 'chat.name': 'KalaSathi'
    },
    hi: {
      'nav.home': 'होम', 'nav.explore': 'भारत खोजें', 'nav.map': 'नक्शा', 'nav.kalasathi': 'कलासाथी', 'nav.lens': 'कलालेंस', 'nav.tours': 'कलाटूर', 'nav.yatri': 'कलायात्री', 'nav.community': 'समुदाय',
      'theme.dark': 'डार्क मोड', 'theme.light': 'लाइट मोड', 'lang.label': 'भाषा',
      'home.h1': 'भारतीय पारंपरिक कला सीखें, एक-एक राज्य के साथ।',
      'home.lede': 'कलावर्स लोक चित्रकला और शिल्प सीखने, उनके बारे में AI गाइड से सवाल पूछने और उन्हें जीवित रखने वाले कारीगरों के साथ एक दिन की यात्रा बनाने का मंच है।',
      'home.explore': 'भारत खोजें', 'home.ask': 'कलासाथी से पूछें', 'home.start': 'किसी कला से शुरुआत करें',
      'home.r1': 'क्षेत्रीय कलाएँ: इतिहास, सांस्कृतिक अर्थ, सामग्री, प्रतीक और हर कला का छोटा ट्यूटोरियल।',
      'home.r2': 'किसी कला, तकनीक या सामग्री के बारे में पूछें और छोटा उत्तर पाएँ। अगले सवाल उसी कला पर बने रहते हैं।',
      'home.r3': 'कारीगर गाँवों, कार्यशालाओं और स्थानीय भोजन पर आधारित एक दिन की सांस्कृतिक यात्राएँ।',
      'home.r4': 'अपनी कलाकृति अपलोड करें और रंग, संतुलन व बारीकी पर सुझाव पाएँ।',
      'home.r5': 'रास्तों, सुगम्यता और कार्यशाला बुकिंग अनुरोधों के लिए यात्रा सहायक।',
      'home.r6': 'कलाकारों का प्रदर्शन, बाज़ार और कार्यशालाएँ।',
      'explore.h': 'भारत खोजें', 'explore.search': 'कला या राज्य खोजें', 'explore.all': 'सभी क्षेत्र',
      'map.h': 'भारत का सांस्कृतिक नक्शा', 'map.sub': 'किसी भी राज्य या केंद्र शासित प्रदेश (कुल 36) पर क्लिक या टैप करें और उसकी कला, शिल्प, टूर और बाज़ार देखें।', 'map.pick': 'राज्य या केंद्र शासित प्रदेश चुनें', 'map.fail': 'नक्शा लोड नहीं हो सका। ऊपर की सूची का उपयोग करें।',
      'tours.h': 'कलाटूर', 'tours.sub': 'अपने लिए एक दिन की सांस्कृतिक यात्रा बनाएँ, या नीचे चुनी हुई यात्राएँ देखें।', 'tours.curated': 'चुनी हुई यात्राएँ',
      'lens.sub': 'अपनी कलाकृति की फ़ोटो अपलोड करें। स्कोर आपके ब्राउज़र में निकलते हैं। गुरु-सुझाव के लिए तस्वीर की एक छोटी प्रति AI मॉडल को भेजी जाती है और इस साइट पर सहेजी नहीं जाती।',
      'yatri.sub': 'सांस्कृतिक यात्राओं के लिए सहायक: रास्ते, सुगम्यता जाँच और कार्यशाला बुकिंग अनुरोध।',
      'comm.h': 'समुदाय और बाज़ार', 'comm.sub': 'कलावर्स डेटा से बनी नमूना सूचियाँ, जो दिखाती हैं कि बाज़ार कैसे काम करेगा। इस साइट पर भुगतान और असली विक्रेता खाते चालू नहीं हैं।',
      'ex.state': 'राज्य', 'ex.capital': 'राजधानी', 'ex.region': 'क्षेत्र', 'ex.ask': 'कलासाथी से पूछें: ', 'ex.history': 'इतिहास', 'ex.sig': 'सांस्कृतिक महत्व', 'ex.good': 'जानने योग्य बातें', 'ex.mat': 'पारंपरिक सामग्री', 'ex.motifs': 'प्रमुख प्रतीक', 'ex.other': 'अन्य शिल्प: ', 'ex.try': 'आज़माएँ: ', 'ex.need': 'आपको चाहिए', 'ex.about': 'लगभग',
      'ex.count': ' कला परंपराएँ', 'ex.of': ' में से ', 'ex.shown': ' दिखाई जा रही हैं।', 'ex.empty': 'कोई कला नहीं मिली। दूसरा शब्द आज़माएँ या सभी क्षेत्र चुनें।',
      'map.art': 'देखने योग्य कला और शिल्प', 'map.places': 'स्थान और अनुभव', 'map.none': 'अभी कोई चुनी हुई एक दिन की यात्रा नहीं है। प्लानर से अपनी बनाएँ।', 'map.learn': 'और जानें', 'map.plan': 'यहाँ एक दिन की योजना बनाएँ', 'map.shop': 'बाज़ार देखें', 'map.ask': 'कलासाथी से पूछें',
      'tips': 'काम की सलाह',
      'zone.North': 'उत्तर', 'zone.South': 'दक्षिण', 'zone.East': 'पूर्व', 'zone.West': 'पश्चिम', 'zone.Central': 'मध्य', 'zone.NorthEast': 'पूर्वोत्तर', 'zone.Islands': 'द्वीप',
      'chat.sub': 'भारतीय कला और शिल्प के लिए आपका गाइड', 'chat.ph': 'किसी कला, सामग्री, इतिहास या उसे बनाने के बारे में पूछें', 'chat.send': 'भेजें', 'chat.new': 'नई चैट',
      'chat.hello': 'नमस्ते! मैं कलासाथी हूँ। मुझसे किसी भारतीय कला के बारे में पूछिए, जैसे "मधुबनी पेंटिंग समझाइए" या "पट्टचित्र में कौन-सी सामग्री लगती है?"।',
      'chat.q1': 'मधुबनी पेंटिंग समझाइए', 'chat.q2': 'वारली पेंटिंग कैसे बनाएँ?', 'chat.q3': 'पट्टचित्र में कौन-सी सामग्री लगती है?', 'chat.q4': 'वारली पेंटिंग का सांस्कृतिक महत्व क्या है?',
      'chat.n1': 'सामग्री', 'chat.n2': 'इतिहास', 'chat.n3': 'क्यों ज़रूरी', 'chat.n4': 'बनाकर देखें',
      'chat.nq1': 'इसमें कौन-सी सामग्री लगती है?', 'chat.nq2': 'इसका इतिहास बताइए', 'chat.nq3': 'यह क्यों महत्वपूर्ण है?', 'chat.nq4': 'इसे कैसे बनाएँ?',
      'chat.off': 'ऑफ़लाइन मोड: उत्तर बने-बनाए विरासत नोट्स (अंग्रेज़ी में) से आते हैं। AI मॉडल चालू करने के लिए सर्वर पर API कुंजी जोड़ें।',
      'chat.nofetch': 'ऑफ़लाइन मोड: चैट सर्वर से संपर्क नहीं हो पाया, इसलिए उत्तर बने-बनाए विरासत नोट्स (अंग्रेज़ी में) से आ रहे हैं।',
      'chat.fallback': 'AI मॉडल से संपर्क नहीं हो सका, इसलिए यह उत्तर बने-बनाए विरासत नोट्स से आया है।',
      'chat.rate': 'थोड़े समय में बहुत सारे सवाल हो गए। कृपया एक मिनट रुककर फिर कोशिश करें।', 'chat.typing': 'कलासाथी लिख रहा है', 'chat.you': 'आप', 'chat.name': 'कलासाथी'
    }
  };

  let lang = get('lang'); if (!LANGS.includes(lang)) lang = 'en';
  let theme = get('theme');
  if (theme !== 'dark' && theme !== 'light') theme = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  root.setAttribute('data-theme', theme);

  const t = (k) => (D[lang] && D[lang][k]) || D.en[k] || k;
  const API = { as: 'as', or: 'or' };
  function apply() {
    root.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); n.setAttribute('aria-label', t(n.dataset.i18nPh)); });
    document.querySelectorAll('[data-i18n-aria]').forEach((n) => n.setAttribute('aria-label', t(n.dataset.i18nAria)));
    const ls = document.getElementById('langsel'); if (ls) { ls.value = lang; ls.setAttribute('aria-label', t('lang.label')); }
    const tb = document.getElementById('themebtn');
    if (tb) { const label = theme === 'dark' ? t('theme.light') : t('theme.dark'); tb.setAttribute('aria-label', label); tb.title = label; tb.textContent = theme === 'dark' ? '☀' : '☾'; tb.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'); }
    const mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.content = theme === 'dark' ? '#2a0a12' : '#5a1420';
  }
  window.I18n = {
    t, get lang() { return lang; }, get theme() { return theme; },
    // Language code sent to the chat server.
    apiLang: () => lang,
    setLang(l) { if (!LANGS.includes(l) || l === lang) return; lang = l; put('lang', l); location.reload(); }, dict: D,
    setTheme(m) { theme = m; put('theme', m); root.setAttribute('data-theme', m); apply(); }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const ls = document.getElementById('langsel'); if (ls) ls.addEventListener('change', () => window.I18n.setLang(ls.value));
    const tb = document.getElementById('themebtn'); if (tb) tb.addEventListener('click', () => window.I18n.setTheme(theme === 'dark' ? 'light' : 'dark'));
    apply();
  });
})();
