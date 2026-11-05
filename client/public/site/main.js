/* PLACA public site behaviour: language switch, mobile menu and public counts.
   No framework and no third-party scripts, so the page stays fast and works on
   slow connections. */

(function () {
  'use strict';

  var html = document.documentElement;
  var originalTitle = document.title;
  var originalDescription = document.querySelector('meta[name="description"]');
  var descriptionText = originalDescription ? originalDescription.getAttribute('content') : '';

  // English strings are captured from the HTML so the page still reads
  // correctly when JavaScript is unavailable. Only Hausa needs a dictionary.
  var en = {};
  document.querySelectorAll('[data-i18n]').forEach(function (element) {
    en[element.getAttribute('data-i18n')] = element.textContent.trim();
  });

  // Strings created by JavaScript, not present in the initial HTML.
  var enDynamic = {
    'results.noMatch': 'No figures match these filters.',
    'results.unavailable':
      'Published figures are temporarily unavailable. Please try again later.',
    'results.generated': 'Last updated: {{date}}',
    'results.showing': 'Showing {{count}} rows.',
    'results.state': 'State'
  };
  Object.keys(enDynamic).forEach(function (key) {
    en[key] = enDynamic[key];
  });

  var ha = {
    'nav.menu': 'Menu',
    'nav.about': 'Game da mu',
    'nav.whatWeDo': 'Abin da muke yi',
    'nav.coverage': 'Yankunan aiki',
    'nav.results': 'Sakamako',
    'nav.highlights': 'Manyan ayyuka',
    'nav.contact': 'Tuntuɓe mu',
    'nav.signIn': 'Shiga ma’aikata',

    'hero.eyebrow': 'Hukumar Yaƙi da AIDS ta Jihar Filato',
    'hero.title': 'Amsa ta HIV cikin haɗin kai ga kowace al’umma a Jihar Filato',
    'hero.intro':
      'PLACA na haɗa gwamnati, abokan hulɗa, hukumomin yaƙi da AIDS na ƙananan hukumomi da al’umma don hana sabbin kamuwa da cutar, tallafawa magani da kulawa, da bin diddigin ci gaba da ingantattun lambobi.',
    'hero.ctaResults': 'Duba sakamakon da aka wallafa',
    'hero.ctaAbout': 'Koyi game da PLACA',
    'hero.stat1Label': 'Ƙananan Hukumomi',
    'hero.stat2Value': '1',
    'hero.stat2Label': 'shirin haɗin kai na jiha',
    'hero.stat3Value': 'Lambobi kawai',
    'hero.stat3Label': 'ba sunaye ko sakamakon gwaji ba',
    'hero.panelNote':
      'Lambobin jama’a ayyuka ne da aka bayar da rahoto, ba tabbatacciyar gaskiya ba. Ana wallafa su ne kawai bayan dubawa.',
    'hero.photoCaption': 'Ma’aikatan PLACA a sakatariyar, Jos',

    'notice.badge': 'Lambobi kawai',
    'notice.title': 'Babu sunaye. Babu adireshi. Babu sakamakon gwaji.',
    'notice.body':
      'Wannan dandali yana ajiye jimillar lambobi ga kowace alama. Ba ya neman sunan mai amfana, lambar waya, adireshi ko sakamakon gwajin HIV.',

    'about.eyebrow': 'Game da PLACA',
    'about.title': 'Hukumar jiha mai kula da yaƙin HIV',
    'about.p1':
      'Hukumar Yaƙi da AIDS ta Jihar Filato (PLACA) ita ce hukumar jiha da ke da alhakin haɗa kan yaƙin HIV da AIDS. Muna aiki da ma’aikatu, abokan ci gaba, ƙungiyoyin jama’a, cibiyoyin lafiya, hukumomin yaƙi da AIDS na ƙananan hukumomi (LACA) da ƙungiyoyin al’umma.',
    'about.p2':
      'Ayyukanmu sun shafi dukan jihar: dukkan ƙananan hukumomi 17, birni da karkara. Muna mai da hankali kan rigakafi, gwaji, haɗi zuwa magani, kulawa da tallafi, da ingantaccen rahoto da ke taimakawa yanke shawara bisa hujja.',
    'about.mandateTitle': 'Aikinmu',
    'about.mandateBody':
      'Haɗa kan yaƙin HIV na jiha, daidaita abokan hulɗa kan shiri ɗaya, da bayar da rahoton ci gaba cikin gaskiya ga gwamnati da jama’a.',
    'about.visionTitle': 'Hangowanmu',
    'about.visionBody':
      'Jihar Filato da babu sabbin kamuwa da HIV, babu mutuwar da ke da alaƙa da AIDS, da babu wariya.',
    'about.missionTitle': 'Manufarmu',
    'about.missionBody':
      'Yin amfani da haɗin kai, bayanai da haɗin gwiwar al’umma don faɗaɗa rigakafi, magani da kulawa, musamman ga waɗanda ke cikin haɗari.',

    'what.eyebrow': 'Abin da muke yi',
    'what.title': 'Hanyoyi huɗu da muke ƙarfafa yaƙin',
    'what.intro':
      'PLACA ba ta ba da kowane sabis kai tsaye ba. Muna sa dukan tsarin ya yi aiki mafi kyau ta hanyar haɗin kai, tallafi da bin diddigin ƙungiyoyin da ke ba da sabis.',
    'what.card1Title': 'Haɗin kai',
    'what.card1Body':
      'Haɗa ma’aikatun jiha, abokan hulɗa da LACA kan manufofi, shirye-shiryen aiki da hanyoyin tura marasa lafiya.',
    'what.card2Title': 'Bayanai da rahoto',
    'what.card2Body':
      'Sauƙaƙe rahoto, gano sabani a lambobi da wuri, da mai da rahotannin da aka amince da su zuwa taƙaitaccen bayani mai amfani.',
    'what.card3Title': 'Tallafin abokan hulɗa',
    'what.card3Body':
      'Taimaka wa ƙungiyoyi su tsara, su bayar da rahoto kuma su warware matsaloli tare, da jagora bayyananne da kayan aiki masu sauƙi.',
    'what.card4Title': 'Haɗin gwiwar al’umma',
    'what.card4Body':
      'Tallafawa wayar da kai, rage wariya da tabbatar da muryar al’umma a cikin yaƙin.',

    'gallery.eyebrow': 'Daga filin aiki',
    'gallery.title': 'PLACA a aikace a fadin Jihar Filato',
    'gallery.intro':
      'Hotuna daga taron PLACA da haɗin gwiwar abokan hulɗa. Suna nuna mutane da wuraren da ke bayan lambobin da aka bayar da rahoto.',
    'gallery.rallyTitle': 'Zangon wayar da kai na Ranar AIDS ta Duniya',
    'gallery.rallyMeta': 'Jos · Disamba 2024',
    'gallery.donationTitle': 'Ma’aikatan CBN sun ba PLACA tallafi',
    'gallery.donationMeta': 'Jos · Agusta 2026',
    'gallery.meetingTitle': 'Taron haɗin kai da abokan hulɗa',
    'gallery.meetingMeta': 'Jos · 2026',
    'gallery.note':
      'Hotuna daga taron PLACA na jama’a ne. Ba a nuna mai amfana ba, kuma ba a bayyana bayanan lafiyar mutum ɗaya ba.',

    'coverage.eyebrow': 'Yankunan aiki',
    'coverage.title': 'Dukkan Ƙananan Hukumomi 17',
    'coverage.intro':
      'PLACA tana haɗa abokan hulɗa a kowace ƙaramar hukuma a Jihar Filato. Kowace ƙaramar hukuma tana da LACA da ke tallafawa rahoto da haɗin kai na gida.',

    'results.eyebrow': 'Sakamakon da aka wallafa',
    'results.title': 'Ayyukan da aka bayar da rahoto a fadin jihar',
    'results.intro':
      'Waɗannan lambobi sun fito ne daga rahotannin da abokan hulɗa da LACA suka mika kuma aka amince da su. Lambobi ne, ba bayanan mutum ɗaya ba. Kullum karanta su a matsayin ayyukan da aka bayar da rahoto, ba tabbatacciyar gaskiya ba.',
    'results.filterPeriod': 'Lokacin rahoto',
    'results.allPeriods': 'Duk lokuta',
    'results.filterIndicator': 'Alama',
    'results.allIndicators': 'Duk alamomi',
    'results.refresh': 'Sabunta lambobi',
    'results.download': 'Sauke CSV',
    'results.loading': 'Ana lodawa lambobin da aka wallafa…',
    'results.statIndicators': 'alamomi da aka wallafa',
    'results.statLgas': 'ƙananan hukumomi masu lambobi',
    'results.statPeriod': 'sabon lokaci',
    'results.tableCaption': 'Lambobin da aka wallafa bisa ƙaramar hukuma da alama',
    'results.tableLga': 'Ƙaramar Hukuma',
    'results.tableIndicator': 'Alama',
    'results.tablePeriod': 'Lokaci',
    'results.tableValue': 'Lamba',
    'results.emptyTitle': 'Babu lambobin da aka wallafa tukuna',
    'results.emptyBody':
      'Lambobi suna bayyana a nan bayan an duba rahotanni, an amince da su kuma an tattara su. Wannan yana kare sirri kuma yana kiyaye daidaiton taƙaitaccen bayanin jama’a.',
    'results.emptyHint': 'Ma’aikata za su iya shiga don mika ko duba rahotanni.',
    'results.emptyCta': 'Shiga ma’aikata',
    'results.note':
      'Ana iya ɓoye ko kewaya ƙananan lambobi don kare mutane. Ba a taɓa raba lambobi ƙasa da matakin ƙaramar hukuma ba.',
    'results.noMatch': 'Babu lambobin da suka dace da waɗannan zaɓuɓɓuka.',
    'results.unavailable':
      'Ba a iya lodawa lambobin jama’a yanzu. Don Allah sake gwadawa daga baya.',
    'results.generated': 'An sabunta: {{date}}',
    'results.showing': 'Ana nuna layuka {{count}}.',
    'results.state': 'Jiha',

    'highlights.eyebrow': 'Manyan ayyuka',
    'highlights.title': 'Inda aka mayar da hankali',
    'highlights.intro':
      'PLACA da abokan hulɗarta suna aiki a duk matakan kulawar HIV. Za a ƙara manyan ayyukan da aka amince da su a nan.',
    'highlights.tagPrevention': 'Rigakafi',
    'highlights.card1Title': 'Rigakafi da gwaji',
    'highlights.card1Body':
      'Wayar da kai a al’umma, sabis na gwajin HIV, shirye-shiryen kwaroron roba da rigakafi ga waɗanda ke cikin haɗari.',
    'highlights.tagTreatment': 'Magani',
    'highlights.card2Title': 'Magani da kulawa',
    'highlights.card2Body':
      'Haɗi zuwa maganin antiretroviral, ci gaba da kulawa, da tallafi ga yara, matasa da mata masu juna biyu.',
    'highlights.tagSystems': 'Tsarin',
    'highlights.card3Title': 'Ƙarfafa tsarin',
    'highlights.card3Body':
      'Ingancin bayanai, haɗin kan abokan hulɗa, bin diddigin shirye-shiryen aiki da sa ido da al’umma ke jagoranta.',
    'highlights.note':
      'Ana wallafa sunayen ayyuka, wurare da sakamako ne kawai bayan dubawa. Ba a taɓa nuna bayanan mai amfana ba.',

    'how.eyebrow': 'Yadda rahoto ke aiki',
    'how.title': 'Daga lissafin takarda zuwa lambar jama’a',
    'how.intro':
      'An gina dandalin ne bisa yadda ake yin aiki a zahiri: abokan hulɗa suna lissafawa a takarda, suna shigar da jimillar idan suna da sigina, PLACA kuma tana dubawa kafin a wallafa komai.',
    'how.step1Title': 'Abokan hulɗa da LACA suna mika lambobi',
    'how.step1Body':
      'Kowace ƙungiya tana bayar da jimillar lambobi na alamominta na lokacin. Ba a tara sunaye ko sakamakon gwaji.',
    'how.step2Title': 'PLACA tana dubawa kuma ta amince',
    'how.step2Body':
      'Jami’ai suna duba daidaito, bin diddigin lambobin da ba a saba gani ba sannan su amince da rahoton. Ana iya gyara rahoton da aka ƙi a sake aikawa.',
    'how.step3Title': 'Ana wallafa jimillar da aka amince da ita',
    'how.step3Body':
      'Rahotannin da aka amince da su kawai, waɗanda aka tattara, suke isa wannan shafi. Kullum ana nuna ranar sabuntawa ta ƙarshe.',

    'contact.eyebrow': 'Tuntuɓe mu',
    'contact.title': 'Yi magana da sakatariyar PLACA',
    'contact.body':
      'Don tambayoyi na hukuma game da yaƙin HIV na jiha, haɗin kan abokan hulɗa ko rahoto, tuntuɓi sakatariyar PLACA a Jos.',
    'contact.addressLabel': 'Adireshi',
    'contact.address': 'Sakatariyar PLACA, Jos, Jihar Filato, Najeriya',
    'contact.hoursLabel': 'Lokacin aiki',
    'contact.hours': 'Litinin zuwa Juma’a, 8:00–16:00',
    'contact.staffLabel': 'Ma’aikata da abokan hulɗa',
    'contact.staffLink': 'Shiga dandalin rahoto',
    'contact.note':
      'Za a wallafa lambar waya da imel na hukuma a nan. Wannan shafi ba ya tara bayanan masu amfana.',

    'footer.tagline': 'Hukumar Yaƙi da AIDS ta Jihar Filato',
    'footer.counts':
      'Lambobi kawai. Babu sunayen masu amfana, adireshi ko sakamakon gwajin HIV.',
    'footer.reported':
      'Lambobin da aka wallafa ayyuka ne da aka bayar da rahoto, ba tabbatacciyar gaskiya ba.'
  };

  var currentLanguage = 'en';

  function t(key, variables) {
    var dictionary = currentLanguage === 'ha' ? ha : en;
    var value = dictionary[key] || en[key] || key;
    if (!variables) return value;
    return value.replace(/\{\{(\w+)\}\}/g, function (_match, name) {
      return variables[name] === undefined ? '' : String(variables[name]);
    });
  }

  function formatNumber(value) {
    try {
      return new Intl.NumberFormat(currentLanguage === 'ha' ? 'ha-NG' : 'en-NG').format(value);
    } catch (_error) {
      return String(value);
    }
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC'
      }).format(new Date(value)) + ' UTC';
    } catch (_error) {
      return value;
    }
  }

  function applyLanguage(language) {
    currentLanguage = language === 'ha' ? 'ha' : 'en';
    html.setAttribute('lang', currentLanguage);
    document.documentElement.setAttribute('data-lang', currentLanguage);

    document.querySelectorAll('[data-i18n]').forEach(function (element) {
      var key = element.getAttribute('data-i18n');
      element.textContent = t(key);
    });

    document.querySelectorAll('.lang-switch button[data-lang]').forEach(function (button) {
      var isActive = button.getAttribute('data-lang') === currentLanguage;
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    document.title =
      currentLanguage === 'ha'
        ? 'PLACA | Hukumar Yaƙi da AIDS ta Jihar Filato'
        : originalTitle;

    if (originalDescription) {
      originalDescription.setAttribute(
        'content',
        currentLanguage === 'ha'
          ? 'Hukumar Yaƙi da AIDS ta Jihar Filato (PLACA) tana haɗa kan yaƙin HIV a dukkan ƙananan hukumomi 17. Duba sakamakon da aka wallafa kuma koyi yadda ake rahoto.'
          : descriptionText
      );
    }

    try {
      window.localStorage.setItem('placa_language', currentLanguage);
    } catch (_error) {
      /* Storage can be blocked; the page still works. */
    }

    if (state.data) {
      populateFilters();
      renderResults();
    }
  }

  function setLanguageFromUrlOrStorage() {
    var params = new URLSearchParams(window.location.search);
    var requested = params.get('lang');
    var stored = null;
    try {
      stored = window.localStorage.getItem('placa_language');
    } catch (_error) {
      stored = null;
    }
    applyLanguage(requested === 'ha' || requested === 'en' ? requested : stored || 'en');
  }

  // ---------- Mobile navigation ----------

  var nav = document.getElementById('site-nav');
  var navToggle = document.querySelector('.nav-toggle');

  if (nav && navToggle) {
    navToggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      nav.setAttribute('data-open', open ? 'false' : 'true');
      navToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.setAttribute('data-open', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.getAttribute('data-open') === 'true') {
        nav.setAttribute('data-open', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 820) {
        nav.setAttribute('data-open', 'false');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('.lang-switch button').forEach(function (button) {
    button.addEventListener('click', function () {
      var language = button.getAttribute('data-lang');
      applyLanguage(language);
      var url = new URL(window.location.href);
      url.searchParams.set('lang', language);
      window.history.replaceState({}, '', url);
    });
  });

  // ---------- Public results ----------

  var state = {
    data: null,
    period: '',
    indicator: '',
    loading: false
  };

  var statusBox = document.getElementById('results-status');
  var summaryBox = document.getElementById('results-summary');
  var tableWrap = document.getElementById('results-table-wrap');
  var emptyBox = document.getElementById('results-empty');
  var tableBody = document.getElementById('results-body');
  var periodFilter = document.getElementById('period-filter');
  var indicatorFilter = document.getElementById('indicator-filter');
  var downloadButton = document.getElementById('download-csv');
  var refreshButton = document.getElementById('refresh-results');

  function setStatus(message) {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
  }

  function hideStatus() {
    if (statusBox) statusBox.hidden = true;
  }

  function fillSelect(select, allLabel, items, current) {
    if (!select) return;
    select.innerHTML = '';
    var all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    select.appendChild(all);

    var stillExists = false;
    items.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
      if (item.value === current) stillExists = true;
    });

    select.value = stillExists ? current : '';
    return stillExists ? current : '';
  }

  function populateFilters() {
    if (!state.data) return;
    state.period = fillSelect(
      periodFilter,
      t('results.allPeriods'),
      (state.data.periods || []).map(function (period) {
        return { value: period, label: period };
      }),
      state.period
    );
    state.indicator = fillSelect(
      indicatorFilter,
      t('results.allIndicators'),
      (state.data.indicators || []).map(function (indicator) {
        return { value: indicator.code, label: indicator.name };
      }),
      state.indicator
    );
  }

  function filteredRows() {
    if (!state.data) return [];
    return (state.data.rows || []).filter(function (row) {
      if (state.period && row.period !== state.period) return false;
      if (state.indicator && row.indicator_code !== state.indicator) return false;
      return true;
    });
  }

  function renderResults() {
    if (!state.data) return;

    var rows = filteredRows();

    if (!state.data.rows || state.data.rows.length === 0) {
      hideStatus();
      summaryBox.hidden = true;
      tableWrap.hidden = true;
      emptyBox.hidden = false;
      downloadButton.hidden = true;
      return;
    }

    if (rows.length === 0) {
      summaryBox.hidden = true;
      tableWrap.hidden = true;
      emptyBox.hidden = true;
      downloadButton.hidden = true;
      setStatus(t('results.noMatch'));
      return;
    }

    hideStatus();
    emptyBox.hidden = true;
    summaryBox.hidden = false;
    tableWrap.hidden = false;
    downloadButton.hidden = false;

    var indicatorCodes = {};
    var lgaNames = {};
    var latestPeriod = '';
    rows.forEach(function (row) {
      indicatorCodes[row.indicator_code] = true;
      if (row.lga_name) lgaNames[row.lga_name] = true;
      if (!latestPeriod || row.period > latestPeriod) latestPeriod = row.period;
    });

    document.getElementById('stat-indicators').textContent = String(
      Object.keys(indicatorCodes).length
    );
    document.getElementById('stat-lgas').textContent = String(Object.keys(lgaNames).length);
    document.getElementById('stat-period').textContent = latestPeriod || '—';

    var generated = document.getElementById('results-generated');
    generated.textContent = state.data.generated_at
      ? t('results.generated', { date: formatDate(state.data.generated_at) })
      : '';

    var sorted = rows.slice().sort(function (left, right) {
      if (left.period !== right.period) return left.period < right.period ? 1 : -1;
      if (left.indicator_name !== right.indicator_name) {
        return left.indicator_name.localeCompare(right.indicator_name);
      }
      return (left.lga_name || '').localeCompare(right.lga_name || '');
    });

    tableBody.innerHTML = '';
    sorted.forEach(function (row) {
      var tr = document.createElement('tr');

      var lga = document.createElement('td');
      lga.textContent = row.lga_name || t('results.state');
      tr.appendChild(lga);

      var indicator = document.createElement('td');
      indicator.textContent = row.indicator_name;
      tr.appendChild(indicator);

      var period = document.createElement('td');
      period.textContent = row.period;
      tr.appendChild(period);

      var value = document.createElement('td');
      value.className = 'numeric';
      value.textContent = formatNumber(row.value);
      tr.appendChild(value);

      tableBody.appendChild(tr);
    });
  }

  async function loadResults() {
    if (state.loading) return;
    state.loading = true;
    setStatus(t('results.loading'));
    if (refreshButton) refreshButton.disabled = true;

    try {
      var response = await fetch('/api/public/summary', {
        headers: { Accept: 'application/json' },
        credentials: 'omit'
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      state.data = await response.json();
      state.period = '';
      state.indicator = '';
      populateFilters();
      renderResults();
    } catch (_error) {
      state.data = null;
      summaryBox.hidden = true;
      tableWrap.hidden = true;
      emptyBox.hidden = true;
      downloadButton.hidden = true;
      setStatus(t('results.unavailable'));
    } finally {
      state.loading = false;
      if (refreshButton) refreshButton.disabled = false;
    }
  }

  function csvCell(value) {
    var text = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function downloadCsv() {
    var rows = filteredRows();
    if (rows.length === 0) return;

    var lines = [['LGA', 'Indicator', 'Period', 'Count']];
    rows.forEach(function (row) {
      lines.push([row.lga_name || 'State', row.indicator_name, row.period, row.value]);
    });

    var csv = lines
      .map(function (line) {
        return line.map(csvCell).join(',');
      })
      .join('\r\n');

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'placa-public-counts-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (periodFilter) {
    periodFilter.addEventListener('change', function () {
      state.period = periodFilter.value;
      renderResults();
    });
  }

  if (indicatorFilter) {
    indicatorFilter.addEventListener('change', function () {
      state.indicator = indicatorFilter.value;
      renderResults();
    });
  }

  if (refreshButton) refreshButton.addEventListener('click', loadResults);
  if (downloadButton) downloadButton.addEventListener('click', downloadCsv);

  setLanguageFromUrlOrStorage();
  loadResults();
})();
