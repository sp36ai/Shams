/**
 * spiritualRepository.ts — Qur'ānic verses, Divine Names, and du'ā
 * mapped to watch verdict states and confidence levels.
 *
 * These are not randomized. Each mapping is deliberate, reflecting
 * the cosmic state and the querent's position within it.
 */

import type { WatchState } from './watchJudgment';
import type { Confidence } from './watchJudgment';

export interface SpiritualRemedy {
  /** Qur'ānic verse (Surah:Ayah and Arabic + transliteration). */
  quran: {
    reference: string;      // "2:216"
    arabic: string;
    transliteration: string;
    english: string;
  };
  /** Divine Name (Asmā' al-Ḥusnā) to invoke. */
  asma: {
    name: string;           // "Yā Fattāḥ"
    count: number;          // 99, 313, etc.
    timing: 'Fajr' | 'Maghrib' | 'Isha' | 'Anytime';
  };
  /** Supplication prayer. */
  dua: {
    arabic: string;
    transliteration: string;
    english: string;
  };
  /** Spiritual practice. */
  practice: {
    sadaqah?: string;       // "Give in secret"
    zikr?: string;          // "Recite..."
    surah?: string;         // "Recite Surah..."
    salat?: string;         // Prayer recommendation
  };
}

// ────────────────────────────────────────────────────────────────
// WATCH STATE × CONFIDENCE MAPPING
// ────────────────────────────────────────────────────────────────

/**
 * FULFILLED (Yes) — The matter is complete or imminent.
 * Confidence downgrades the certainty, not the outcome.
 */
export const FULFILLED_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '2:216',
      arabic: 'فَإِذَا قُضِيَتِ الصَّلَاةُ فَانتَشِرُوا فِي الْأَرْضِ',
      transliteration: "Fa-idha qudiyat as-salatu fantashiru fi al-ard",
      english: 'And when the prayer has ended, disperse in the land.',
    },
    asma: {
      name: 'Yā al-Qawiyy (The Strong)',
      count: 111,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'اللَّهُمَّ اجْعَل هَذَا الخَيْرَ بِدَايَةَ خَيْرٍ لَا نِهَايَةَ لَهُ',
      transliteration:
        "Allahumma ij'al hadha al-khayr bidayata khayrin la nihayata lah",
      english: 'O Allah, make this good a beginning of endless blessing.',
    },
    practice: {
      sadaqah: 'Give two portions: one hidden, one to the poor.',
      salat: 'Pray two rak'ahs of gratitude after this reading.',
    },
  },

  HIGH: {
    quran: {
      reference: '65:2-3',
      arabic:
        'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ',
      transliteration:
        'Wa man yattaqi Allah yaj'al lahu makhraj wa yarzuqhu min haythu la yahtasib',
      english:
        'Whoever is mindful of Allah, He will make for him a way out and provide for him from where he does not expect.',
    },
    asma: {
      name: 'Yā Fattāḥ (The Opener)',
      count: 99,
      timing: 'Maghrib',
    },
    dua: {
      arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي',
      transliteration: 'Rabbi ishrach li sadri wa yassir li amri',
      english: 'My Lord, expand my chest and make my task easy.',
    },
    practice: {
      zikr: 'Recite Subhanallah 33 times, Alhamdulillah 33 times, Allahu Akbar 34 times.',
      salat: 'Offer two voluntary rak'ahs of thanksgiving.',
    },
  },

  MODERATE: {
    quran: {
      reference: '94:5-6',
      arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا إِنَّ مَعَ الْعُسْرِ يُسْرًا',
      transliteration: 'Fa-inna ma'a al-'usri yusra, inna ma'a al-'usri yusra',
      english: 'Indeed, with hardship comes ease. Indeed, with hardship comes ease.',
    },
    asma: {
      name: 'Yā al-Ḥakīm (The Wise)',
      count: 70,
      timing: 'Anytime',
    },
    dua: {
      arabic:
        'اللَّهُمَّ لَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ وَأَصْلِحْ شَأْنِي كُلَّهُ',
      transliteration:
        'Allahumma la takilni ila nafsi tarfata ayn wa aslih sha\'ni kullahu',
      english:
        'O Allah, do not entrust me to myself even for the blink of an eye; set all my affairs in order.',
    },
    practice: {
      sadaqah: 'Distribute charity to three people in need.',
      surah: 'Recite Surah al-Fātiḥa for yourself and for this matter.',
    },
  },

  LOW: {
    quran: {
      reference: '93:7',
      arabic: 'وَوَجَدَكَ ضَالًّا فَهَدَىٰ',
      transliteration: 'Wa wajadaka dāllan fa-hadā',
      english: 'And He found you searching, and guided you.',
    },
    asma: {
      name: 'Yā al-Ḥādī (The Guide)',
      count: 100,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'يَا كَافِي يَا غَنِي يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
      transliteration: 'Ya Kafi, ya Ghani, ya dha al-Jalali wa al-Ikram',
      english: 'O Sufficient One, O Self-Sufficient, O Lord of Majesty and Generosity.',
    },
    practice: {
      zikr: 'Recite "Lā ḥawla wa lā quwwata illā billāh" 41 times.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '42:19',
      arabic: 'وَاللَّهُ لَطِيفٌ بِعِبَادِهِ يَرْزُقُ مَن يَشَاءُ',
      transliteration: 'Wa-Allah latifun bi-ibādihi yarzuqu man yasha',
      english: 'And Allah is Subtle with His servants; He provides for whom He wills.',
    },
    asma: {
      name: 'Yā al-Laṭīf (The Subtle)',
      count: 313,
      timing: 'Isha',
    },
    dua: {
      arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
      transliteration: 'Hasbunallah wa ni\'am al-wakil',
      english: 'Allah is sufficient for us, and He is the best disposer of affairs.',
    },
    practice: {
      sadaqah: 'Give a small hidden charity.',
      salat: 'Perform Istikharah prayer; ask Allah to choose what is best for you.',
    },
  },
});

/**
 * MOVING (Conditional Yes) — The matter is progressing but not yet settled.
 * Action and patience are both required.
 */
export const MOVING_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '3:186',
      arabic:
        'لَتُبْلَوُنَّ فِي أَمْوَالِكُمْ وَأَنفُسِكُمْ وَلَتَسْمَعُنَّ مِنَ الَّذِينَ أُوتُوا الْكِتَابَ',
      transliteration:
        'Latublawunna fi amwalikum wa anfusikum wa latosma\'unna min alladhina utoo al-kitab',
      english:
        'You will surely be tested in your wealth and in yourselves, and you will hear much hurt from those given the Scripture.',
    },
    asma: {
      name: 'Yā as-Ṣabūr (The Patient)',
      count: 99,
      timing: 'Maghrib',
    },
    dua: {
      arabic:
        'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
      transliteration:
        'Rabbana atina fi ad-dunya hasanah wa fi al-akhirah hasanah wa qina adhab an-nar',
      english:
        'Our Lord, give us good in this life and good in the Hereafter, and protect us from the torment of the Fire.',
    },
    practice: {
      zikr: 'Recite "Subhanallah wa bihamdihi" 100 times daily.',
      salat: 'Pray 2 rak\'ahs of seeking strength (Salat al-Istiqamah).',
    },
  },

  HIGH: {
    quran: {
      reference: '16:127',
      arabic: 'وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ',
      transliteration: 'Wa-sbir wa ma sabrika illa billah',
      english: 'And be patient, and your patience is not but through Allah.',
    },
    asma: {
      name: 'Yā al-'Azīz (The Mighty)',
      count: 70,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'اللَّهُمَّ اعِنِّي بِصَبْرٍ وَقُوَّةٍ عَلَى مَا تُرِيدُ',
      transliteration: 'Allahumma a\'inni bi-sabrin wa quwwatin ala ma turid',
      english: 'O Allah, help me with patience and strength for what You will.',
    },
    practice: {
      sadaqah: 'Feed a person in need.',
      zikr: 'Recite "Yā Muḥassinu dhunūbi" (O Remover of Sins) 50 times.',
    },
  },

  MODERATE: {
    quran: {
      reference: '2:250',
      arabic: 'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا',
      transliteration: 'Rabbana afrigh alayna sabra wa thabit aqdamana',
      english: 'Our Lord, pour upon us patience and firm our feet.',
    },
    asma: {
      name: 'Yā as-Salāmu (The Peace)',
      count: 41,
      timing: 'Anytime',
    },
    dua: {
      arabic: 'اللَّهُمَّ أَيْقِظْ قَلْبِي عَلَى طَاعَتِكَ',
      transliteration: 'Allahumma ayyqiz qalbi ala ta\'atika',
      english: 'O Allah, awaken my heart to Your obedience.',
    },
    practice: {
      surah: 'Recite Surah al-Bayyinah (Chapter 98).',
    },
  },

  LOW: {
    quran: {
      reference: '87:16',
      arabic: 'بَلْ تُؤْثِرُونَ الْحَيَاةَ الدُّنْيَا وَالْآخِرَةُ خَيْرٌ وَأَبْقَىٰ',
      transliteration: 'Bal tu\'thirun al-hayat ad-dunya wa al-akhirah khayrun wa abqa',
      english:
        'But you prefer the worldly life, while the Hereafter is better and more lasting.',
    },
    asma: {
      name: 'Yā al-Walī (The Guardian)',
      count: 81,
      timing: 'Isha',
    },
    dua: {
      arabic: 'وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ',
      transliteration: "Wa 'asa an takrahu shay\'an wa huwa khayrun lakum",
      english: 'Perhaps you dislike a thing while it is good for you.',
    },
    practice: {
      zikr: 'Recite "Allahu Akbar" 40 times in the morning.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '25:74',
      arabic:
        'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
      transliteration:
        'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a\'yunin wa-j\'alna li al-muttaqin imama',
      english:
        'Our Lord, grant us from our spouses and offspring comfort to our eyes and make us leaders for the righteous.',
    },
    asma: {
      name: 'Yā al-Wadūd (The Loving)',
      count: 100,
      timing: 'Maghrib',
    },
    dua: {
      arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِن لِسَانِي',
      transliteration:
        'Rabbi ishrach li sadri wa yassir li amri wa-hulul \'uqdatan min lisani',
      english:
        'My Lord, expand my chest and make my task easy and untie a knot from my tongue.',
    },
    practice: {
      sadaqah: 'Give water to someone in need.',
      surah: 'Recite Surah ad-Duḥā (Chapter 93) daily.',
    },
  },
});

/**
 * DELAYED (Wait) — The matter will manifest, but timing is long or blocked by Zuhal.
 * Patience is the teacher; action now is preparation.
 */
export const DELAYED_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '47:31',
      arabic: 'أَمْ حَسِبْتُمْ أَن تَدْخُلُوا الْجَنَّةَ وَلَمَّا يَعْلَمِ اللَّهُ الَّذِينَ جَاهَدُوا مِنكُمْ',
      transliteration:
        'Am hasabtum an tadkhulu al-jannata wa lamma ya\'lam Allah alladhina jahadu minkum',
      english:
        'Did you think you would enter Paradise without Allah knowing who strives among you?',
    },
    asma: {
      name: 'Yā al-Mushī (The Defeater)',
      count: 70,
      timing: 'Fajr',
    },
    dua: {
      arabic:
        'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ الْعَجْزِ وَالْكَسَلِ وَالْجُبْنِ وَالْبُخْلِ',
      transliteration:
        'Allahumma inni a\'uudhu bika min al-ajz wa al-kasal wa al-jubn wa al-bukhl',
      english:
        'O Allah, I seek refuge in You from incapacity, laziness, cowardice, and stinginess.',
    },
    practice: {
      zikr: 'Recite "Yā Kabīr" (O Great) 99 times daily.',
      sadaqah: 'Feed the hungry steadily; this becomes your bridge to the delayed matter.',
    },
  },

  HIGH: {
    quran: {
      reference: '89:14',
      arabic: 'فَصَبَرَ فَكَانَ مِنَ الْعَازِمِينَ',
      transliteration: 'Fa-sabara fa-kana min al-\\\'aziminÂ',
      english: 'So he was patient and became one of the resolute.',
    },
    asma: {
      name: 'Yā al-Jabarr (The Irresistible)',
      count: 41,
      timing: 'Maghrib',
    },
    dua: {
      arabic: 'لَا إِلَهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ',
      transliteration:
        'La ilaha illa anta subhanaka inni kuntu min adh-dhalimin',
      english:
        'There is no god but You; glory be to You. Indeed, I have been among the wrongdoers.',
    },
    practice: {
      surah: 'Recite Surah al-Aʿrāf (Chapter 7) during waiting season.',
      salat: 'Pray Qiyam (night vigil) during the delay period.',
    },
  },

  MODERATE: {
    quran: {
      reference: '31:17',
      arabic:
        'يَا بُنَيَّ أَقِمِ الصَّلَاةَ وَأْمُرْ بِالْمَعْرُوفِ وَانْهَ عَنِ الْمُنكَرِ وَاصْبِرْ عَلَىٰ مَا أَصَابَكَ',
      transliteration:
        'Ya bunayya aqim as-salata wa\'mur bi al-ma\'ruf wa-nha \\'an al-munkar wa-sbir ala ma asabak',
      english:
        'O my son, establish prayer and enjoin what is right and forbid what is wrong, and be patient over what befalls you.',
    },
    asma: {
      name: 'Yā as-Ṣabūr (The Patient)',
      count: 100,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'لا حول ولا قوة إلا بالله العلي العظيم',
      transliteration: 'La hawla wa la quwwata illa billahi al-aliyy al-aẓim',
      english:
        'There is no might or power except with Allah, the Most High, the Most Great.',
    },
    practice: {
      zikr: 'Recite daily: "Allahu Akbar wa Alhamdulillah wa Subhanallah".',
    },
  },

  LOW: {
    quran: {
      reference: '50:45',
      arabic: 'نَحْنُ أَعْلَمُ بِمَا يَقُولُونَ وَمَا أَنتَ عَلَيْهِم بِجَبَّارٍ',
      transliteration:
        'Nahnu a\'lam bima yaqulun wa ma anta alayhim bi-jabbar',
      english:
        'We are most knowing of what they say, and you are not over them a tyrant.',
    },
    asma: {
      name: 'Yā al-Laṭīf (The Subtle)',
      count: 70,
      timing: 'Isha',
    },
    dua: {
      arabic: 'وَهُوَ أَرْحَمُ الرَّاحِمِينَ',
      transliteration: 'Wa huwa arham ar-rahimin',
      english: 'And He is the Most Merciful of the merciful.',
    },
    practice: {
      salat: 'Pray Ṣalāt al-Istikhārah: seek Allah\'s choice, not your own.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '7:189',
      arabic: 'فَإِن طَلَّقَهَا فَلَا تَحِلُّ لَهُ مِن بَعْدُ حَتَّىٰ تَنكِحَ زَوْجًا غَيْرَهُ',
      transliteration:
        'Fa-in tallaqa-ha fa-la tahillu lahu min ba\'du hatta tankiha zawjan ghayrah',
      english:
        'So if he divorces her, she is not permissible to him again until she marries another.',
    },
    asma: {
      name: 'Yā al-Ḥakīm (The Wise)',
      count: 99,
      timing: 'Anytime',
    },
    dua: {
      arabic:
        'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ وَأَسْتَقْدِرُكَ بِقُوَّتِكَ',
      transliteration:
        'Allahumma inni astakhiruka bi-ilmika wa astaqdruka bi-quwwatika',
      english: 'O Allah, I seek Your choice through Your knowledge.',
    },
    practice: {
      zikr: 'Recite "La hawla wa la quwwata" 41 times.',
      sadaqah: 'Distribute consistent charity during the waiting season.',
    },
  },
});

/**
 * BLOCKED (No) — The matter is obstructed and will not manifest in the querent's favor.
 * Redirection and acceptance are the teachers.
 */
export const BLOCKED_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '2:216',
      arabic:
        'عَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ وَعَسَىٰ أَن تُحِبُّوا شَيْئًا وَهُوَ شَرٌّ لَّكُمْ',
      transliteration:
        'Asa an takrahu shay\'an wa huwa khayrun lakum wa asa an tuhibbu shay\'an wa huwa sharrun lakum',
      english:
        'Perhaps you dislike a thing while it is good for you, and perhaps you love a thing while it is bad for you.',
    },
    asma: {
      name: 'Yā al-Mudill (The Humiliator)',
      count: 33,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'رَبَّنَا لَا تُؤَاخِذْنَا بِمَا نَسِينَا أَوْ أَخْطَأْنَا',
      transliteration: 'Rabbana la tu\'akhidhna bima nasina aw akhta\'na',
      english: 'Our Lord, do not punish us if we forget or make a mistake.',
    },
    practice: {
      sadaqah: 'Give significant charity; this is your redirection fee.',
      zikr: 'Recite "Subhanallah wa bihamdihi" 100 times, asking Allah to open a better door.',
    },
  },

  HIGH: {
    quran: {
      reference: '3:139',
      arabic: 'فَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ',
      transliteration:
        'Fa-la tahinu wa-la tahzanu wa-antum al-a\'llaun in kuntum mu\'minin',
      english:
        'So do not weaken and do not grieve. You will have the upper hand if you are true believers.',
    },
    asma: {
      name: 'Yā al-Mudayyiq (The Compressor)',
      count: 70,
      timing: 'Maghrib',
    },
    dua: {
      arabic:
        'اللَّهُمَّ لَا تَجْعَلْنِي مِنَ الْقَوْمِ الظَّالِمِينَ وَلَكِن مِّنَ الْقَوْمِ الصَّالِحِينَ',
      transliteration:
        'Allahumma la taj\'alni min al-qawm adh-dhalimin wa lakin min al-qawm as-saliheen',
      english:
        'O Allah, do not make me among the wrongdoers, but among the righteous.',
    },
    practice: {
      surah: 'Recite Surah al-Insirāh (Chapter 94) — it speaks of doors closing and opening.',
      salat: 'Pray two rak\'ahs of seeking new direction.',
    },
  },

  MODERATE: {
    quran: {
      reference: '18:24',
      arabic: 'وَقُل عَسَىٰ أَن يَهْدِيَنِ رَبِّي لِأَقْرَبَ مِنْ هَٰذَا رَشَدًا',
      transliteration:
        'Wa qul asa ay yahdiyani rabbi li-aqrab min hadha rashada',
      english: 'And say: "Perhaps my Lord will guide me to what is closer in righteousness."',
    },
    asma: {
      name: 'Yā al-Ḥādī (The Guide)',
      count: 100,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ إِنَّكَ أَنتَ التَّوَّابُ الرَّحِيمُ',
      transliteration:
        'Rabbi aghfir li wa tub alayya innaka anta at-tawwab ar-rahim',
      english:
        'My Lord, forgive me and accept my repentance; You are the Ever-Turning, the Merciful.',
    },
    practice: {
      zikr: 'Recite "Astaghfiru Allah" (I seek Allah\'s forgiveness) 100 times daily.',
    },
  },

  LOW: {
    quran: {
      reference: '13:28',
      arabic:
        'الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
      transliteration:
        'Alladhina amanu wa tatmain qulubuhum bi-dhikr Allah ala bi-dhikr Allah tatmain al-qulub',
      english:
        'Those who believed and their hearts find rest in the remembrance of Allah. Verily in the remembrance of Allah do hearts find rest.',
    },
    asma: {
      name: 'Yā al-Waddūd (The Loving, Affectionate)',
      count: 70,
      timing: 'Isha',
    },
    dua: {
      arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
      transliteration: 'Hasbunallah wa ni\'am al-wakil',
      english: 'Allah is sufficient for us, and He is the best disposer of affairs.',
    },
    practice: {
      sadaqah: 'Give and do not expect return; this breaks the blockage within you.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '41:30-32',
      arabic:
        'إِنَّ الَّذِينَ قَالُوا رَبُّنَا اللَّهُ ثُمَّ اسْتَقَامُوا تَتَنَزَّلُ عَلَيْهِمُ الْمَلَائِكَةُ',
      transliteration:
        'Inna alladhina qalu rabbuna Allah thumma istaqamu tatanzal alayhim al-mala\'ika',
      english:
        'Indeed, those who have said, "Our Lord is Allah," and then remained on a right course — the angels will descend upon them.',
    },
    asma: {
      name: 'Yā al-Qahhār (The Irresistible Force)',
      count: 33,
      timing: 'Anytime',
    },
    dua: {
      arabic: 'يَا لَطِيفُ بِاللطفِ أَخْرِجْنِي مِنْ هَذِهِ الضِّيقَةِ',
      transliteration: 'Ya Latif bil-latif akhrij ni min hadhihi adh-dhiqah',
      english: 'O Subtle One, with Your subtlety extract me from this narrowness.',
    },
    practice: {
      surah:
        'Recite Surah al-Qadr (Chapter 97) — even the smallest night can hold the greatest power.',
    },
  },
});

/**
 * REVERSING (Conditional) — The matter turns back on itself; expect rework or overturn.
 * Flexibility and re-evaluation are the teachers.
 */
export const REVERSING_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '2:286',
      arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
      transliteration: 'La yukallifu Allah nafsan illa wus\'aha',
      english: 'Allah does not burden a soul beyond its capacity.',
    },
    asma: {
      name: 'Yā al-ʿAliyy (The Most High)',
      count: 99,
      timing: 'Fajr',
    },
    dua: {
      arabic:
        'اللَّهُمَّ أَعِدْ لِي مِنْ أَمْرِي فُرْجًا وَمَخْرَجًا وَاجْعَلْ لِي مِنْ كُلِّ هَمٍّ فَرَجًا',
      transliteration:
        'Allahumma a\'id li min amri furjan wa makhraj wa-j\'al li min kulli hammin faraja',
      english:
        'O Allah, provide me relief in my matter and a way out, and grant ease from every hardship.',
    },
    practice: {
      zikr: 'Recite "Allahu Akbar" 70 times when you feel the reversal.',
      salat: 'Pray Tahajjud (night prayer); the night sees what day cannot.',
    },
  },

  HIGH: {
    quran: {
      reference: '55:26-27',
      arabic: 'كُلُّ مَن عَلَيْهَا فَانٍ وَيَبْقَىٰ وَجْهُ رَبِّكَ ذُو الْجَلَالِ وَالْإِكْرَامِ',
      transliteration:
        'Kullu man alayha fan wa yabqa wajh rabbika dhu al-jalal wa al-ikram',
      english:
        'All that is on it will perish, but the Face of your Lord will remain, possessor of majesty and honor.',
    },
    asma: {
      name: 'Yā al-Muqaddim (The Expediter)',
      count: 70,
      timing: 'Maghrib',
    },
    dua: {
      arabic:
        'رَبِّ أَعِنِّي عَلَىٰ ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
      transliteration:
        'Rabbi a\'inni ala dhikrika wa shukrika wa husn ibadatika',
      english:
        'My Lord, help me in Your remembrance, Your gratitude, and the beauty of Your worship.',
    },
    practice: {
      sadaqah: 'When the reversal happens, give immediately as a sign of acceptance.',
      zikr: 'Recite "Yā Muqaddim" (O Expediter) when you feel the shift.',
    },
  },

  MODERATE: {
    quran: {
      reference: '46:35',
      arabic: 'فَاصْبِرْ كَمَا صَبَرَ أُولُو الْعَزْمِ مِنَ الرُّسُلِ',
      transliteration: 'Fasbir kama sabara ulu al-azm min ar-rusul',
      english: 'So be patient as were those of determination among the messengers.',
    },
    asma: {
      name: 'Yā al-Muakhkhir (The Delayer)',
      count: 41,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ تَقَلُّبِ الْأَحْوَالِ',
      transliteration: 'Allahumma inni a\'udhu bika min taqallub al-ahwal',
      english:
        'O Allah, I seek refuge in You from the vicissitude of states.',
    },
    practice: {
      surah: 'Recite Surah at-Talāq (Chapter 65) — it speaks of transitions and new beginnings.',
    },
  },

  LOW: {
    quran: {
      reference: '73:10',
      arabic:
        'وَاصْبِرْ عَلَىٰ مَا يَقُولُونَ وَاهْجُرْهُمْ هَجْرًا جَمِيلًا',
      transliteration:
        'Wa-sbir ala ma yaqulun wa-hjur-hum hajran jamila',
      english:
        'And be patient over what they say, and leave them with gracious dignity.',
    },
    asma: {
      name: 'Yā as-Samī' (The Hearer)',
      count: 100,
      timing: 'Isha',
    },
    dua: {
      arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ',
      transliteration: 'Wa idha sa\'alaka ibadi anni fa-inni qareeb',
      english: 'When My servants ask you about Me, I am near.',
    },
    practice: {
      zikr: 'Call upon Allah throughout the day; He hears and responds.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '76:30',
      arabic: 'وَمَا تَشَاءُونَ إِلَّا أَن يَشَاءَ اللَّهُ',
      transliteration: 'Wa ma tasha\'un illa an yasha\'a Allah',
      english: 'And you will not will except that Allah wills.',
    },
    asma: {
      name: 'Yā al-Ḥakīm (The Wise)',
      count: 99,
      timing: 'Anytime',
    },
    dua: {
      arabic:
        'اللَّهُمَّ أَنتَ الرَّب وَأَنَا الْعَبْدُ، فَاخْتَرْ لِي خِيَرَةَ مَا تَشَاءُ',
      transliteration:
        'Allahumma anta ar-rabb wa ana al-abd, fa-khtar li khiyarata ma tasha',
      english:
        'O Allah, You are the Lord and I am Your servant; choose for me the good of what You will.',
    },
    practice: {
      salat: 'Pray Istikharah: ask Allah to choose the best path when confusion arrives.',
    },
  },
});

/**
 * UNFORMED (Unclear) — The chart has not settled; no clear reading emerges.
 * Clarity and inner preparation are the teachers.
 */
export const UNFORMED_REMEDY: Record<Confidence, SpiritualRemedy> = Object.freeze({
  VERY_HIGH: {
    quran: {
      reference: '3:26',
      arabic:
        'قُلِ اللَّهُمَّ مَالِكَ الْمُلْكِ تُؤْتِي الْمُلْكَ مَن تَشَاءُ وَتَنزِعُ الْمُلْكَ مِمَّن تَشَاءُ',
      transliteration:
        'Qul Allahumma malik al-mulk tu\'ti al-mulk man tasha wa tanzau al-mulk mimman tasha',
      english:
        'Say: O Allah, Possessor of all power, You give power to whom You will and take it from whom You will.',
    },
    asma: {
      name: 'Yā al-ʿAlīm (The All-Knowing)',
      count: 100,
      timing: 'Fajr',
    },
    dua: {
      arabic:
        'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَقَلْبًا خَاشِعًا وَعَمَلًا مُتَقَبَّلًا',
      transliteration:
        'Allahumma inni as\'aluka ilman nafi\'an wa qalban khaashi\'an wa amalan mutaqabbalan',
      english:
        'O Allah, I ask You for beneficial knowledge, a humble heart, and accepted deeds.',
    },
    practice: {
      sadaqah: 'Give to those who seek knowledge.',
      zikr: 'Recite "Alhamdulillah" (All praise to Allah) 100 times for clarity.',
    },
  },

  HIGH: {
    quran: {
      reference: '2:32',
      arabic:
        'قَالُوا سُبْحَانَكَ لَا عِلْمَ لَنَا إِلَّا مَا عَلَّمْتَنَا إِنَّكَ أَنتَ الْعَلِيمُ الْحَكِيمُ',
      transliteration:
        'Qalu subhanaka la ilma lana illa ma allamtana innaka anta al-alim al-hakim',
      english:
        'They said: Glory to You; we have no knowledge except that which You have taught us. Indeed, You are the All-Knowing, the All-Wise.',
    },
    asma: {
      name: 'Yā al-Ḥakīm (The Wise)',
      count: 70,
      timing: 'Maghrib',
    },
    dua: {
      arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِن لِسَانِي',
      transliteration:
        'Rabbi ishrach li sadri wa yassir li amri wa-hulul \'uqdatan min lisani',
      english:
        'My Lord, expand my chest, make my task easy, and untie a knot from my tongue.',
    },
    practice: {
      surah: 'Recite Surah al-ʿAlaq (Chapter 96) — it speaks of seeking knowledge.',
    },
  },

  MODERATE: {
    quran: {
      reference: '33:33',
      arabic:
        'وَقَرْنَ فِي بُيُوتِكُنَّ وَلَا تَبَرَّجْنَ تَبَرُّجَ الْجَاهِلِيَّةِ الْأُولَىٰ',
      transliteration:
        'Wa qarinna fi buyutkun wa-la tabarrjna tabarruja al-jahiliyya al-ula',
      english:
        'And remain in your homes and do not display yourselves as in the former times of ignorance.',
    },
    asma: {
      name: 'Yā ad-Dāʾim (The Eternal)',
      count: 41,
      timing: 'Fajr',
    },
    dua: {
      arabic: 'رَبِّ أَرِنِي الْحَقَّ حَقًّا وَارْزُقْنِي اتِّبَاعَهُ وَأَرِنِي الْبَاطِلَ بَاطِلًا وَارْزُقْنِي اجْتِنَابَهُ',
      transliteration:
        'Rabbi arini al-haq haqan warzuqni ittiba\'ahu wa arni al-batil batilan warzuqni ijtinabahu',
      english:
        'My Lord, show me the truth as truth and grant me to follow it; show me falsehood as falsehood and grant me to avoid it.',
    },
    practice: {
      zikr: 'Recite "Subhanallah, Alhamdulillah, Allahu Akbar" as your clarity mantra.',
    },
  },

  LOW: {
    quran: {
      reference: '11:123',
      arabic: 'فَاسْتَقِمْ كَمَا أُمِرْتَ وَمَن تَابَ مَعَكَ وَلَا تَطْغَوْا',
      transliteration:
        'Fastaqim kama umirt wa man taba ma\'ak wa-la tatghaw',
      english:
        'So remain on the straight path as you have been commanded, along with those who have repented with you, and do not transgress.',
    },
    asma: {
      name: 'Yā al-Mustaʿān (The One to Whom Appeal Is Made)',
      count: 100,
      timing: 'Isha',
    },
    dua: {
      arabic: 'يَا أَحَدُ يَا صَمَدُ يَا مَنْ لَمْ يَلِدْ وَلَمْ يُولَدْ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ',
      transliteration:
        'Ya Ahad ya Samad ya man lam yalid wa lam yuwal wa lam yakun lahu kufuan ahad',
      english:
        'O Unique, O Self-Sufficient, O You who begets not and is not begotten, and there is none comparable to You.',
    },
    practice: {
      sadaqah: 'Give without condition; clarity comes when the heart opens.',
    },
  },

  UNCERTAIN: {
    quran: {
      reference: '27:62',
      arabic:
        'أَمَّن يُجِيبُ الْمُضْطَرَّ إِذَا دَعَاهُ وَيَكْشِفُ السُّوءَ وَيَجْعَلُكُمْ خُلَفَاءَ الْأَرْضِ',
      transliteration:
        'Amman yujib al-mudtar idha da\'ahu wa yakshif as-su\' a wa yaj\'alukum khulafa\' al-ard',
      english:
        'Who answers the distressed one when he calls upon Him and removes evil and makes you successors of the earth?',
    },
    asma: {
      name: 'Yā al-Qadīr (The All-Powerful)',
      count: 99,
      timing: 'Anytime',
    },
    dua: {
      arabic: 'إِنَّكَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ',
      transliteration: 'Innaka ala kulli shay\'in qadir',
      english: 'Indeed, You are over all things competent.',
    },
    practice: {
      salat:
        'Pray Qiyam (night vigil) and seek clarity; Allah speaks most clearly in the silence of night.',
    },
  },
});

export const REMEDY_MAP: Readonly<
  Record<WatchState, Record<Confidence, SpiritualRemedy>>
> = Object.freeze({
  FULFILLED: FULFILLED_REMEDY,
  MOVING: MOVING_REMEDY,
  DELAYED: DELAYED_REMEDY,
  BLOCKED: BLOCKED_REMEDY,
  REVERSING: REVERSING_REMEDY,
  UNFORMED: UNFORMED_REMEDY,
});
