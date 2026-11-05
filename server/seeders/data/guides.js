'use strict';

/**
 * Starter help content in English and Hausa.
 *
 * These rows are data, not code. PLACA officers can edit them in the guide
 * editor without a developer. Field hints use the same four headings in this
 * order: meaning, paper equivalent, example, common mistake.
 *
 * Markdown only: no raw HTML is stored or rendered.
 */

const ALL = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director', 'admin'];
const PARTNER = ['partner_staff'];
const PLACA = ['placa_officer', 'placa_director'];
const LACA = ['laca_officer'];

const GUIDES = [
  {
    key: 'getting_started',
    page_key: 'dashboard',
    sort_order: 10,
    roles: ALL,
    en: {
      title: 'Your first week on the platform',
      body: `## Start here

You do not need to learn everything today. Do these four things in order.

1. **Complete your profile.** Check your name, phone number and organization.
2. **Take the short tour.** It points to the main buttons one at a time.
3. **Practise a report.** Practice mode never saves or sends anything.
4. **Send your first report.** Ask your LACA officer if you are unsure.

### If you get stuck

Open **Help** in the menu. Every guide works without signal once it has been opened once. You can also print a blank paper form and keep using paper while you learn.`,
    },
    ha: {
      title: 'Makon farko a dandalin',
      body: `## Fara a nan

Ba sai ka koyi komai yau ba. Yi waɗannan abubuwa huɗu a jere.

1. **Cika bayaninka.** Duba sunanka, lambar wayarka da ƙungiyarka.
2. **Yi ɗan ziyara.** Zai nuna maka manyan maɓallan ɗaya bayan ɗaya.
3. **Gwada rahoto.** Yanayin gwada ba ya ajiye ko aika komai.
4. **Aika rahotonka na farko.** Tambayi jami'in LACA idan ba ka da tabbas.

### Idan ka tsaya

Buɗe **Taimako** a menu. Kowace jagora tana aiki ba tare da sigina ba bayan an buɗe ta sau ɗaya. Za ka iya kuma buga takardar ƙidaya mara komai ka ci gaba da amfani da takarda yayin koyo.`,
    },
  },
  {
    key: 'dashboard_reading',
    page_key: 'dashboard',
    sort_order: 20,
    roles: ALL,
    en: {
      title: 'How to read your dashboard',
      body: `## What the dashboard shows

The dashboard shows **reported activity**, not verified fact. It is what partners sent, not what auditors confirmed.

- **People reached** counts people your organization reported.
- **Targets versus actuals** compares your workplan target with what you reported.
- **Reporting rate** shows how many organizations sent a report for the period.

A red or amber flag means "please check this figure", not "this figure is wrong".`,
    },
    ha: {
      title: 'Yadda za ka karanta dashboard ɗinka',
      body: `## Abin da dashboard ke nunawa

Dashboard na nuna **ayyukan da aka bayar da rahoto**, ba tabbatarwa ba. Abin da abokan hulɗa suka aiko ne, ba abin da masu bincike suka tabbatar ba.

- **Mutanen da aka isar wa** suna ƙidaya mutanen da ƙungiyarka ta bayar da rahoto.
- **Manufa da abin da aka yi** na kwatanta manufar shirin aikinka da abin da ka bayar.
- **Yawan bayar da rahoto** na nuna ƙungiyoyi nawa suka aika rahoto a wannan lokacin.

Alamar ja ko rawaya tana nufin "don Allah duba wannan lambar", ba "wannan lambar ba daidai ba ce".`,
    },
  },
  {
    key: 'organization_profile',
    page_key: 'organization',
    sort_order: 30,
    roles: ['partner_staff', 'laca_officer', 'placa_officer'],
    en: {
      title: 'Register or update your organization',
      body: `## Register your organization

1. Open **My organization**.
2. Fill in the organization name, type and LGA.
3. Add a contact person and phone number.
4. Save. Your LACA officer and PLACA will see it as **Pending**.
5. After a PLACA officer approves it, you can send reports.

### Keep it current

Tell your LACA officer when your phone number or contact person changes. Reports and alerts use these details.`,
    },
    ha: {
      title: 'Yi rijistar ƙungiyarka ko sabunta ta',
      body: `## Yi rijistar ƙungiyarka

1. Buɗe **Ƙungiyata**.
2. Rubuta sunan ƙungiya, irinta da Ƙaramar Hukuma.
3. Ƙara sunan mai tuntuɓa da lambar waya.
4. Ajiye. Jami'in LACA da PLACA za su gan ta a matsayin **Ana jira**.
5. Bayan jami'in PLACA ya amince, za ka iya aika rahoto.

### Ci gaba da sabunta ta

Sanar da jami'in LACA idan lambar wayarka ko mai tuntuɓa ya canja. Rahotanni da sanarwa suna amfani da waɗannan bayanai.`,
    },
  },
  {
    key: 'workplan_guide',
    page_key: 'workplan',
    sort_order: 40,
    roles: PARTNER,
    en: {
      title: 'Set your quarterly targets',
      body: `## Why a workplan matters

A workplan is your promise for the quarter. It says how many people you plan to reach for each indicator.

1. Choose the year and quarter.
2. For each indicator, type the number you plan to reach.
3. Add the LGA where the work will happen.
4. Save. You can change it until the quarter starts.

Targets are compared with your reports on the dashboard.`,
    },
    ha: {
      title: 'Sanya manufofinka na kwata',
      body: `## Me ya sa shirin aiki yake da muhimmanci

Shirin aiki alkawarinka ne na kwata. Yana faɗin mutane nawa ka shirya isar wa ga kowace alama.

1. Zaɓi shekara da kwata.
2. Ga kowace alama, rubuta lambar da ka shirya isar wa.
3. Ƙara Ƙaramar Hukumar da aikin zai yi.
4. Ajiye. Za ka iya canza shi har kwata ta fara.

Ana kwatanta manufofi da rahotanninka a dashboard.`,
    },
  },
  {
    key: 'report_guide',
    page_key: 'report',
    sort_order: 50,
    roles: PARTNER,
    en: {
      title: 'Send your first report',
      body: `## The paper tally sheet, on screen

The form follows your paper tally sheet. Columns appear in the same order and use the same words.

1. Choose the quarter.
2. Type each total exactly as it is on your tally sheet.
3. Check that each breakdown adds up to the total.
4. Read the summary. It says which period you are sending.
5. Press **Send**. A sent report is locked and cannot be edited.

### If the number is rejected

The message tells you which column to check. For example: "People who tested positive cannot be more than people tested. Please check column 4."`,
    },
    ha: {
      title: 'Aika rahotonka na farko',
      body: `## Takardar ƙidaya a kan allo

Fom ɗin yana bin takardar ƙidaya ta takarda. Rukunoni suna fitowa a jere ɗaya kuma suna amfani da kalmomi ɗaya.

1. Zaɓi kwata.
2. Rubuta kowace lamba kamar yadda take a takardar ƙidaya.
3. Duba cewa kowane rarrabuwa ya haɗu ya zama jimillar.
4. Karanta taƙaitawa. Tana faɗin lokacin da kake aika.
5. Danna **Aika**. Rahoton da aka aika yana kullewa kuma ba za a iya gyara shi ba.

### Idan an ƙi lambar

Saƙon zai faɗa maka ginshiƙin da za ka duba. Misali: "Waɗanda suka gwada sun kamu ba za su wuce waɗanda aka gwada ba. Don Allah duba ginshiƙi na 4."`,
    },
  },
  {
    key: 'no_signal',
    page_key: 'offline',
    sort_order: 60,
    roles: ALL,
    en: {
      title: 'What to do with no signal',
      body: `## Work offline, send later

You can keep working when the network is weak or absent.

- Every change is saved on this device immediately.
- The badge says **Saved on this phone** or **Waiting for signal**.
- When signal returns, open the app and press **Send now**.

Do not clear the browser data or uninstall the app before a pending report has been sent. That would delete the unsent copy on the device.`,
    },
    ha: {
      title: 'Abin da za ka yi idan babu sigina',
      body: `## Yi aiki ba tare da intanet ba, aika daga baya

Za ka iya ci gaba da aiki idan hanyar sadarwa ta yi rauni ko babu ita.

- Kowace canji ana ajiye shi a wannan na'ura nan take.
- Alamar tana cewa **An ajiye a wannan waya** ko **Ana jiran sigina**.
- Idan sigina ya dawo, buɗe manhajar ka danna **Aika yanzu**.

Kada ka goge bayanan manhaja ko cire ta kafin a aika rahoton da ke jira. Hakan zai goge kwafin da ba a aika ba a na'urar.`,
    },
  },
  {
    key: 'returned_report',
    page_key: 'report',
    sort_order: 70,
    roles: PARTNER,
    en: {
      title: 'Fix a returned report',
      body: `## When a report comes back

Your LACA officer returns a report when a figure needs checking.

1. Open **Reports** and find the report marked **Returned**.
2. Read the reason in plain words.
3. Change only the figures mentioned, unless you find another error.
4. Send the corrected report.

The old version stays in the history. Nothing is lost.`,
    },
    ha: {
      title: 'Gyara rahoton da aka mayar',
      body: `## Idan rahoto ya dawo

Jami'in LACA zai mayar da rahoto idan wata lamba tana buƙatar dubawa.

1. Buɗe **Rahotanni** ka nemo wanda aka yi wa alamar **An mayar**.
2. Karanta dalilin a cikin kalmomi masu sauƙi.
3. Canza lambobin da aka ambata kawai, sai idan ka sami wani kuskure.
4. Aika rahoton da aka gyara.

Tsohon sigar yana nan a tarihi. Babu abin da ya ɓace.`,
    },
  },
  {
    key: 'support_request_guide',
    page_key: 'support',
    sort_order: 80,
    roles: PARTNER,
    en: {
      title: 'Request equipment, training or technical help',
      body: `## Ask PLACA for support

1. Open **Support requests** and press **New request**.
2. Choose Equipment, Training or Technical help.
3. Explain what you need and why, in plain words.
4. For equipment, add each item and the quantity.
5. Send. You will see the request move through Requested, Approved, In transit and Delivered.

Confirm receipt when the items arrive. That closes the record.`,
    },
    ha: {
      title: 'Nemi kayan aiki, horo ko taimakon fasaha',
      body: `## Nemi tallafi daga PLACA

1. Buɗe **Buƙatun tallafi** ka danna **Sabuwar buƙata**.
2. Zaɓi Kayan aiki, Horo ko Taimakon fasaha.
3. Bayyana abin da kake buƙata da dalili, cikin kalmomi masu sauƙi.
4. Don kayan aiki, ƙara kowane abu da adadinsa.
5. Aika. Za ka ga buƙatar tana wucewa daga An nema, An amince, Yana hanya zuwa An kai.

Tabbatar da karɓa idan kayan sun iso. Hakan yana rufe rikodin.`,
    },
  },
  {
    key: 'funding_guide',
    page_key: 'funding',
    sort_order: 90,
    roles: PLACA,
    en: {
      title: 'Record funding and allocations',
      body: `## Money in, money allocated

1. Record each **source** of money (government, donor, private, other).
2. Record each **inflow** when money is actually received.
3. Record an **allocation** to a partner or an LGA.
4. Mark it **disbursed** only when the money has left the PLACA account.

The dashboard groups allocations by LGA so inequity is visible. Amounts are stored to two decimal places and are never rounded in the database.`,
    },
    ha: {
      title: 'Rubuta kuɗi da rabon kuɗi',
      body: `## Kuɗi shiga, rabon kuɗi

1. Rubuta kowace **tushen** kuɗi (gwamnati, mai ba da tallafi, kamfani, wani).
2. Rubuta kowace **shigowar** kuɗi idan an karɓa da gaske.
3. Rubuta **rabon** kuɗi ga abokin hulɗa ko Ƙaramar Hukuma.
4. Yi alama **an biya** ne kawai idan kuɗin ya fita daga asusun PLACA.

Dashboard na tara rabon kuɗi bisa Ƙaramar Hukuma don a ga rashin daidaito. Adadin kuɗi ana ajiye shi da lambobi biyu bayan digo kuma ba a zagaye shi a bayanai.`,
    },
  },
  {
    key: 'documents_guide',
    page_key: 'documents',
    sort_order: 100,
    roles: ALL,
    en: {
      title: 'Find guidelines and training materials',
      body: `## The resource library

Open **Documents** to find guidelines, training materials, workplans and policies.

- Use the search box or filter by category and language.
- Press a document to download it.
- Documents you have downloaded stay available offline.

Only PLACA officers upload documents. If a document is missing, use **Contact support** in Help.`,
    },
    ha: {
      title: 'Nemo jagorori da kayan horo',
      body: `## ɗakin karatu na albarkatu

Buɗe **Takardu** don nemo jagorori, kayan horo, shirye-shiryen aiki da manufofi.

- Yi amfani da akwatin bincike ko tace bisa nau'i da harshe.
- Danna takarda don saukar da ita.
- Takardun da ka saukar suna kasancewa ba tare da intanet ba.

Jami'an PLACA ne kawai ke ɗora takardu. Idan takarda ta ɓace, yi amfani da **Tuntuɓi tallafi** a Taimako.`,
    },
  },
  {
    key: 'help_center_guide',
    page_key: 'help',
    sort_order: 110,
    roles: ALL,
    en: {
      title: 'How to use the Help Centre',
      body: `## Help is always here

The Help Centre has searchable guides, answers to common questions, a glossary and short step-by-step walkthroughs.

- Search by the words you see on screen.
- The glossary explains words like **reached**, **validated** and **disaggregation**.
- **Contact support** sends a message to PLACA. It needs a connection.
- Everything else works offline after it has been opened once.`,
    },
    ha: {
      title: 'Yadda za ka yi amfani da Cibiyar Taimako',
      body: `## Taimako yana nan koyaushe

Cibiyar Taimako tana da jagorori da za a bincika, amsoshin tambayoyi na yau da kullum, ƙamus da gajerun matakai.

- Bincika da kalmomin da kake gani a allo.
- Ƙamus ɗin yana bayyana kalmomi kamar **isar da sako**, **tabbatarwa** da **rarrabuwa**.
- **Tuntuɓi tallafi** yana aika saƙo zuwa PLACA. Yana buƙatar intanet.
- Sauran abubuwa suna aiki ba tare da intanet ba bayan an buɗe su sau ɗaya.`,
    },
  },
  {
    key: 'privacy_guide',
    page_key: 'help',
    sort_order: 120,
    roles: ALL,
    en: {
      title: 'Why we only collect counts',
      body: `## Counts, never names

This platform never stores a beneficiary's name, address, phone number or HIV test result.

We store only **numbers per indicator**, for example "12 people tested". This protects the people we serve and follows the Nigeria Data Protection Regulation (NDPR) 2019.

If a paper tally sheet contains names, keep it in your office. Do not type names into any box on this platform.`,
    },
    ha: {
      title: 'Me ya sa muke tara lambobi kawai',
      body: `## Lambobi, ba sunaye ba

Wannan dandali ba ya ajiye sunan mai amfana, adireshi, lambar waya ko sakamakon gwajin HIV.

Muna ajiye **lambobi ga kowace alama** kawai, misali "an gwada mutane 12". Wannan yana kare mutanen da muke yi wa aiki kuma yana bin Dokar Kare Bayanai ta Najeriya (NDPR) 2019.

Idan takardar ƙidaya ta takarda tana da sunaye, ajiye ta a ofishinka. Kada ka rubuta sunaye a kowane akwati a wannan dandali.`,
    },
  },
  {
    key: 'account_security',
    page_key: 'account',
    sort_order: 130,
    roles: ALL,
    en: {
      title: 'Protect your account',
      body: `## Your password

- Use at least 8 characters, with upper case, lower case and a number.
- Never share your password, even with a colleague. Ask for a separate account.
- Change a temporary password the first time you sign in.
- Sign out on a shared tablet when you finish.

If your phone is lost or you think someone knows your password, tell your LACA officer or PLACA immediately.`,
    },
    ha: {
      title: 'Kare asusunka',
      body: `## Kalmar sirrinka

- Yi amfani da aƙalla haruffa 8, da manyan haruffa, ƙananan haruffa da lamba.
- Kada ka raba kalmar sirrinka, ko da abokin aikinka ne. Nemi asusu daban.
- Canza kalmar sirri ta wucin gadi a lokacin da ka shiga karon farko.
- Fita idan ka gama a kan na'urar da ake rabawa.

Idan wayarka ta ɓace ko kana tsammanin wani ya san kalmar sirrinka, sanar da jami'in LACA ko PLACA nan take.`,
    },
  },
  {
    key: 'laca_validation',
    page_key: 'report-review',
    sort_order: 140,
    roles: LACA,
    en: {
      title: 'Check and validate partner reports',
      body: `## Your role as LACA officer

You see reports from organizations in your LGA only.

1. Open **Reports to review**.
2. Compare the figures with the partner's workplan and previous reports.
3. If the report is complete, press **Validate**.
4. If a figure needs checking, press **Return** and write a short, plain reason.

Returning a report is not a punishment. It is a request to check a number. Never edit a partner's numbers yourself.`,
    },
    ha: {
      title: 'Duba da tabbatar da rahotannin abokan hulɗa',
      body: `## Matsayinka na jami'in LACA

Kana ganin rahotannin ƙungiyoyin da ke Ƙaramar Hukumarka kawai.

1. Buɗe **Rahotannin da za a duba**.
2. Kwatanta lambobin da shirin aikin abokin hulɗa da rahotannin baya.
3. Idan rahoton ya cika, danna **Tabbatar**.
4. Idan wata lamba tana buƙatar dubawa, danna **Mayar** ka rubuta gajeren dalili cikin kalmomi masu sauƙi.

Mayar da rahoto ba hukunci ba ne. Buƙatar duba lamba ce. Kada ka gyara lambobin abokin hulɗa da kanka.`,
    },
  },
  {
    key: 'placa_aggregation',
    page_key: 'reports',
    sort_order: 150,
    roles: PLACA,
    en: {
      title: 'Aggregate validated reports',
      body: `## From partner report to state total

Only validated reports can be aggregated. Aggregation adds numbers across organizations and LGAs for the quarter.

1. Open **Reports** and filter by quarter and status.
2. Check any flagged figures first.
3. Press **Aggregate** for the quarter.
4. Export the quarterly PDF or CSV for the national body.

The export footer states that figures are reported activity, not verified fact.`,
    },
    ha: {
      title: 'Tara rahotannin da aka tabbatar',
      body: `## Daga rahoton abokin hulɗa zuwa jimillar jiha

Rahotannin da aka tabbatar ne kawai za a iya tarawa. Tarawa tana haɗa lambobi daga ƙungiyoyi da Ƙananan Hukumomi don kwata.

1. Buɗe **Rahotanni** ka tace bisa kwata da matsayi.
2. Duba duk wata lamba da aka yi wa alama da farko.
3. Danna **Tara** don kwata.
4. Fitar da PDF ko CSV na kwata don hukumar ƙasa.

Ƙasan fitarwar yana faɗin cewa lambobin ayyukan da aka bayar da rahoto ne, ba tabbatarwa ba.`,
    },
  },
  {
    key: 'glossary',
    page_key: 'help',
    sort_order: 160,
    roles: ALL,
    en: {
      title: 'Glossary of useful words',
      body: `## Words used in this platform

- **Reached**: a person received at least one message or service from your organization in the period. Count each person once.
- **Disaggregation**: a breakdown of a total, for example by sex or age.
- **Draft**: a report you can still change.
- **Submitted**: a report you have sent. It is locked.
- **Validated**: a LACA officer checked the report.
- **Returned**: a LACA officer asked you to check a figure.
- **Aggregated**: a PLACA officer added the report into the state total.
- **Target**: the number you planned in your workplan.
- **Indicator**: one thing we count, such as people tested for HIV.`,
    },
    ha: {
      title: 'Ƙamus na kalmomi masu amfani',
      body: `## Kalmomin da ake amfani da su a wannan dandali

- **Isar da sako**: mutum ya sami aƙalla sako ko sabis ɗaya daga ƙungiyarka a lokacin. Ƙidaya kowane mutum sau ɗaya.
- **Rarrabuwa**: raba jimilla, misali bisa jinsi ko shekaru.
- **Rubutun farko**: rahoton da za ka iya canzawa.
- **An mika**: rahoton da ka aika. An kulle shi.
- **An tabbatar**: jami'in LACA ya duba rahoton.
- **An mayar**: jami'in LACA ya nemi ka duba wata lamba.
- **An tara**: jami'in PLACA ya ƙara rahoton cikin jimillar jiha.
- **Manufa**: lambar da ka shirya a shirin aikinka.
- **Alama**: abu ɗaya da muke ƙidaya, kamar mutanen da aka gwada wa HIV.`,
    },
  },

  // ---------- Field hints: reporting ----------
  {
    key: 'report.field.persons_tested',
    page_key: 'report',
    field_key: 'persons_tested',
    sort_order: 10,
    roles: PARTNER,
    en: {
      title: 'People tested for HIV',
      body: `### What it means
The number of people your organization tested for HIV in this period.

### On the paper form
Column 1 of the tally sheet, headed "Tested".

### Example
If your tally sheet shows 18 tests, type **18**. Count a person once even if they tested twice.

### Common mistake
Adding the positive and negative results together. Type only the number tested, not the sum of results.`,
    },
    ha: {
      title: 'Mutanen da aka gwada wa HIV',
      body: `### Abin da yake nufi
Adadin mutanen da ƙungiyarka ta gwada wa HIV a wannan lokacin.

### A takardar ƙidaya
Ginshiƙi na 1 na takardar ƙidaya, mai taken "An gwada".

### Misali
Idan takardar ƙidaya ta nuna gwaje-gwaje 18, rubuta **18**. Ƙidaya mutum sau ɗaya ko da ya gwada sau biyu.

### Kuskure da aka saba yi
Haɗa sakamakon kamuwa da marasa kamuwa tare. Rubuta adadin da aka gwada kawai, ba jimillar sakamako ba.`,
    },
  },
  {
    key: 'report.field.persons_positive',
    page_key: 'report',
    field_key: 'persons_positive',
    sort_order: 20,
    roles: PARTNER,
    en: {
      title: 'People who tested positive',
      body: `### What it means
The number of people whose HIV test was positive in this period.

### On the paper form
Column 4 of the tally sheet, headed "Positive".

### Example
If 18 people were tested and 2 were positive, type **2** here.

### Common mistake
Typing a number bigger than the number tested. This figure can never be larger than column 1.`,
    },
    ha: {
      title: 'Mutanen da suka gwada sun kamu',
      body: `### Abin da yake nufi
Adadin mutanen da gwajin HIV ɗinsu ya nuna kamuwa a wannan lokacin.

### A takardar ƙidaya
Ginshiƙi na 4 na takardar ƙidaya, mai taken "Sun kamu".

### Misali
Idan an gwada mutane 18 kuma 2 sun kamu, rubuta **2** a nan.

### Kuskure da aka saba yi
Rubuta lamba da ta fi adadin da aka gwada. Wannan lamba ba za ta taɓa wuce ginshiƙi na 1 ba.`,
    },
  },
  {
    key: 'report.field.people_reached',
    page_key: 'report',
    field_key: 'people_reached',
    sort_order: 30,
    roles: PARTNER,
    en: {
      title: 'People reached with messages',
      body: `### What it means
People who received at least one HIV prevention or awareness message from you this period.

### On the paper form
The "Reached" tally, usually kept separately from the testing sheet.

### Example
You held three community talks and 120 people attended. Count each person once, so type **120**, not 360.

### Common mistake
Counting the same person at every session. The number is people, not attendance.`,
    },
    ha: {
      title: 'Mutanen da aka isar wa da sako',
      body: `### Abin da yake nufi
Mutanen da suka sami aƙalla sako ɗaya na rigakafin HIV ko wayar da kai daga gare ka a wannan lokacin.

### A takardar ƙidaya
Ƙidayar "An isar wa", yawanci ana ajiye ta dabam da takardar gwaji.

### Misali
Ka yi jawabai uku na al'umma kuma mutane 120 suka halarta. Ƙidaya kowane mutum sau ɗaya, don haka rubuta **120**, ba 360 ba.

### Kuskure da aka saba yi
Ƙidaya mutum ɗaya a kowane zama. Lambar mutane ce, ba yawan halarta ba.`,
    },
  },
  {
    key: 'report.field.condoms_distributed',
    page_key: 'report',
    field_key: 'condoms_distributed',
    sort_order: 40,
    roles: PARTNER,
    en: {
      title: 'Condoms distributed',
      body: `### What it means
The number of condoms you gave out, not the number of people who received them.

### On the paper form
The stock issue column on the commodity tally sheet.

### Example
Ten people each take five condoms. Type **50**.

### Common mistake
Typing the number of people (10). The unit here is condoms.`,
    },
    ha: {
      title: 'Robar da aka raba',
      body: `### Abin da yake nufi
Adadin roba da ka bayar, ba adadin mutanen da suka karɓa ba.

### A takardar ƙidaya
Ginshiƙin fitar da kaya a takardar ƙidaya ta kayan aiki.

### Misali
Mutane goma kowanne ya ɗauki roba biyar. Rubuta **50**.

### Kuskure da aka saba yi
Rubuta adadin mutane (10). Naúrar a nan roba ce.`,
    },
  },
  {
    key: 'report.field.people_trained',
    page_key: 'report',
    field_key: 'people_trained',
    sort_order: 50,
    roles: PARTNER,
    en: {
      title: 'People trained',
      body: `### What it means
People who completed a training session you organized or supported this period.

### On the paper form
The attendance register, last page, where participants sign out.

### Example
A two-day training had 25 people on day one and 22 on day two, all the same people. Type **25** completers if all 25 finished.

### Common mistake
Adding day one and day two attendance (47). Count people, not days.`,
    },
    ha: {
      title: 'Mutanen da aka horar',
      body: `### Abin da yake nufi
Mutanen da suka kammala zaman horo da ka shirya ko ka tallafa a wannan lokacin.

### A takardar ƙidaya
Littafin halarta, shafi na ƙarshe, inda mahalarta ke sa hannu na fita.

### Misali
Horo na kwana biyu yana da mutane 25 a rana ta farko da 22 a rana ta biyu, duk mutane ɗaya. Rubuta **25** waɗanda suka kammala idan duka 25 sun kammala.

### Kuskure da aka saba yi
Haɗa halartar rana ta farko da ta biyu (47). Ƙidaya mutane, ba kwanaki ba.`,
    },
  },
  {
    key: 'report.field.quarter',
    page_key: 'report',
    field_key: 'quarter',
    sort_order: 5,
    roles: PARTNER,
    en: {
      title: 'Reporting quarter',
      body: `### What it means
The three-month period this report covers.

### On the paper form
The top-right box of the tally sheet, where the officer writes the quarter.

### Example
July to September 2026 is **2026, Quarter 3**.

### Common mistake
Reporting the current quarter instead of the one just ended. Choose the quarter shown on the paper sheet, not today's date.`,
    },
    ha: {
      title: 'Kwatun rahoto',
      body: `### Abin da yake nufi
Lokacin watanni uku da wannan rahoto ya shafa.

### A takardar ƙidaya
Akwatin saman dama na takardar ƙidaya, inda jami'in ke rubuta kwata.

### Misali
Yuli zuwa Satumba 2026 shine **2026, Kwata ta 3**.

### Kuskure da aka saba yi
Bayar da rahoton kwatar da ke gudana maimakon wadda ta ƙare. Zaɓi kwatar da ke kan takardar, ba ranar yau ba.`,
    },
  },
  {
    key: 'workplan.field.target_value',
    page_key: 'workplan',
    field_key: 'target_value',
    sort_order: 10,
    roles: PARTNER,
    en: {
      title: 'Target number',
      body: `### What it means
How many people you plan to reach for this indicator this quarter.

### On the paper form
The "Planned" column of your quarterly workplan.

### Example
If you plan 200 HIV tests, type **200**.

### Common mistake
Copying last quarter's target without checking whether your team or budget has changed.`,
    },
    ha: {
      title: 'Lambar manufa',
      body: `### Abin da yake nufi
Mutane nawa ka shirya isar wa ga wannan alama a wannan kwata.

### A takardar ƙidaya
Ginshiƙin "An shirya" na shirin aikinka na kwata.

### Misali
Idan ka shirya gwaje-gwajen HIV 200, rubuta **200**.

### Kuskure da aka saba yi
Kwafin manufar kwatar da ta gabata ba tare da duba ko ƙungiyarka ko kasafin kuɗinka ya canja ba.`,
    },
  },
  {
    key: 'support.field.description',
    page_key: 'support',
    field_key: 'description',
    sort_order: 10,
    roles: PARTNER,
    en: {
      title: 'What do you need?',
      body: `### What it means
A short, plain explanation of the support you need and how it will be used.

### On the paper form
The "Remarks" box on the paper support request form.

### Example
"We need 500 rapid test kits for outreach in Wase in August. We expect to test 250 people."

### Common mistake
Writing only "test kits". PLACA needs to know how many and which activity they are for.`,
    },
    ha: {
      title: 'Me kake buƙata?',
      body: `### Abin da yake nufi
Gajeren bayani mai sauƙi game da tallafin da kake buƙata da yadda za a yi amfani da shi.

### A takardar ƙidaya
Akwatin "Bayanan ƙari" a takardar neman tallafi ta takarda.

### Misali
"Muna buƙatar kayan gwajin gaggawa 500 don wayar da kai a Wase a watan Agusta. Muna sa ran gwada mutane 250."

### Kuskure da aka saba yi
Rubuta "kayan gwaji" kawai. PLACA na buƙatar sanin adadi da aikin da za a yi da su.`,
    },
  },
  {
    key: 'funding.field.amount',
    page_key: 'funding',
    field_key: 'amount',
    sort_order: 10,
    roles: PLACA,
    en: {
      title: 'Amount in naira',
      body: `### What it means
The exact amount received or allocated, in naira.

### On the paper form
The "Amount (₦)" column of the funding register.

### Example
Two million, five hundred thousand naira is **2500000.00**.

### Common mistake
Typing "2.5m" or adding a comma. Use digits only; the decimal point is allowed, for example 2500000.00.`,
    },
    ha: {
      title: 'Adadin kuɗi a naira',
      body: `### Abin da yake nufi
Adadin da aka karɓa ko aka ware daidai, a naira.

### A takardar ƙidaya
Ginshiƙin "Adadi (₦)" na littafin kuɗi.

### Misali
Miliyan biyu da dubu ɗari biyar **2500000.00** ne.

### Kuskure da aka saba yi
Rubuta "2.5m" ko saka waƙafi. Yi amfani da lambobi kawai; ana iya amfani da digo, misali 2500000.00.`,
    },
  },
  {
    key: 'organization.field.name',
    page_key: 'organization',
    field_key: 'name',
    sort_order: 10,
    roles: ['partner_staff', 'laca_officer', 'placa_officer'],
    en: {
      title: 'Organization name',
      body: `### What it means
The official name of your organization, exactly as it appears on your registration certificate.

### On the paper form
The header of your organization's reporting form.

### Example
**Hope Foundation Jos**

### Common mistake
Using a short name or acronym that PLACA will not recognise. Put the full name here.`,
    },
    ha: {
      title: 'Sunan ƙungiya',
      body: `### Abin da yake nufi
Sunan hukuma na ƙungiyarka, daidai yadda yake a takardar rijista.

### A takardar ƙidaya
Kan takardar rahoton ƙungiyarka.

### Misali
**Hope Foundation Jos**

### Kuskure da aka saba yi
Yin amfani da gajeren suna ko taƙaitaccen haruffa da PLACA ba za ta gane ba. Rubuta cikakken suna a nan.`,
    },
  },
  {
    key: 'organization.field.contact_phone',
    page_key: 'organization',
    field_key: 'contact_phone',
    sort_order: 20,
    roles: ['partner_staff', 'laca_officer', 'placa_officer'],
    en: {
      title: 'Contact phone number',
      body: `### What it means
A phone number PLACA can call about reports or alerts.

### On the paper form
The contact box at the bottom of the organization registration form.

### Example
**08031234567**

### Common mistake
Writing a number with spaces or starting with +234. Use the local form, for example 0803 123 4567.`,
    },
    ha: {
      title: 'Lambar wayar mai tuntuɓa',
      body: `### Abin da yake nufi
Lambar waya da PLACA za ta iya kira game da rahotanni ko sanarwa.

### A takardar ƙidaya
Akwatin tuntuɓa a ƙasan takardar rijistar ƙungiya.

### Misali
**08031234567**

### Kuskure da aka saba yi
Rubuta lamba da sarari ko fara da +234. Yi amfani da tsarin gida, misali 0803 123 4567.`,
    },
  },
  {
    key: 'report.field.organization',
    page_key: 'report',
    field_key: 'organization',
    sort_order: 1,
    roles: PARTNER,
    en: {
      title: 'Reporting organization',
      body: `### What it means
The organization whose tally sheets you are reporting.

### On the paper form
The organization stamp or name at the top of the tally sheet.

### Example
**Rural Health Initiative**

### Common mistake
Sending one organization's numbers under another organization's account. Sign in with the correct account.`,
    },
    ha: {
      title: 'Ƙungiyar da ke bayar da rahoto',
      body: `### Abin da yake nufi
Ƙungiyar da takardun ƙidayarta kake bayar da rahoto.

### A takardar ƙidaya
Tambarin ƙungiya ko suna a saman takardar ƙidaya.

### Misali
**Rural Health Initiative**

### Kuskure da aka saba yi
Aika lambobin ƙungiya ɗaya a ƙarƙashin asusun wata ƙungiya. Shiga da asusun da ya dace.`,
    },
  },
];

module.exports = { GUIDES, ALL, PARTNER, PLACA, LACA };
