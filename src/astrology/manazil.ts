// Al-Manāzil al-Qamar — The 28 Stations of the Moon
// User-facing Arabic lunar mansion system for Shams al-Asrār.
// Engine uses KP nakshatra boundaries internally.
// This layer surfaces Arabic names + oracle descriptors ONLY.

export interface Manzila {
  number: number;
  name: string;
  arabic: string;
  stars: string;
  startDegree: number;
  nature: 'benefic' | 'malefic' | 'mixed';
  element: 'fire' | 'earth' | 'air' | 'water';
  oracleDescriptor: string;
  oracleVoice: string;
  confirmedTheme: string;
  deniedTheme: string;
}

export const MANAZIL_AL_QAMAR: Manzila[] = [
  {
    number: 1,
    name: 'Al-Sharaṭayn',
    arabic: 'الشَّرَطَيْن',
    stars: 'β + γ Arietis',
    startDegree: 0,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: 'The Two Signs — beginnings forged in fire',
    oracleVoice: 'al-Qamar stands in Al-Sharaṭayn tonight — the station of the two marks, where new paths are branded into existence. What begins here carries the scar of its origin as a seal of authenticity.',
    confirmedTheme: 'A forceful opening. What is confirmed here arrives suddenly, without gradual preparation. Move without hesitation.',
    deniedTheme: 'The flame burns against the direction of travel. The path attempted is not the one being opened. Look for a different entry point entirely.',
  },
  {
    number: 2,
    name: 'Al-Buṭayn',
    arabic: 'البُطَيْن',
    stars: 'ε + δ + ρ Arietis',
    startDegree: 12.857,
    nature: 'benefic',
    element: 'earth',
    oracleDescriptor: 'The Little Belly — hidden nourishment gathering',
    oracleVoice: 'al-Qamar rests in Al-Buṭayn — the station of the hidden reservoir, where nourishment accumulates unseen before it overflows. What is growing in secret is growing well.',
    confirmedTheme: 'What is confirmed here has been quietly preparing for longer than the seeker knows. The arrival will feel sudden but the roots are deep.',
    deniedTheme: 'The reservoir has not yet filled. The matter needs more time underground before it can surface. Forcing it now empties what has barely begun to gather.',
  },
  {
    number: 3,
    name: 'Al-Thurayya',
    arabic: 'الثُّرَيَّا',
    stars: 'Pleiades',
    startDegree: 25.714,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: 'The Pleiades — abundance descending from height',
    oracleVoice: "al-Qamar dwells in Al-Thurayya — the station of the seven sisters, where what scattered returns gathered. The Pleiades have long been the Arabs's sign of rain after drought. Something long awaited is condensing above you.",
    confirmedTheme: 'Abundance confirmed. Multiple blessings arrive together, not one by one. The seeker should prepare to receive more than they asked for.',
    deniedTheme: 'The sisters have turned their faces away. What was hoped for is dispersing rather than gathering. This is not the season for this harvest.',
  },
  {
    number: 4,
    name: 'Al-Dabarān',
    arabic: 'الدَّبَرَان',
    stars: 'Aldebaran — α Tauri',
    startDegree: 38.571,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: 'The Follower — pursuit that closes the distance',
    oracleVoice: 'al-Qamar rests in Al-Dabarān — the station of the follower, the red eye of the bull that trails the Pleiades across the sky without ever catching them. Here, pursuit is the condition, not the conclusion.',
    confirmedTheme: 'What is sought is confirmed but remains in motion. The seeker must continue to move toward it — it will not come to a standing figure. Confirmed means the chase ends in arrival, not that arrival has come.',
    deniedTheme: 'The follower reaches but the distance does not close. What is pursued recedes at the same pace as the approach. Withdrawal now preserves dignity and energy for a better season.',
  },
  {
    number: 5,
    name: "Al-Haqʿa",
    arabic: 'الهَقْعَة',
    stars: 'λ + φ¹ + φ² Orionis',
    startDegree: 51.428,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: 'The White Spot — clarity emerging from confusion',
    oracleVoice: "al-Qamar stands in Al-Haqʿa — the station of the white mark on the horse's flank, the distinguishing sign that separates one from many. Clarity is the gift of this station. What was obscure becomes identifiable.",
    confirmedTheme: 'The path is confirmed and it becomes clear to others as well as the seeker. Recognition and distinction accompany this opening.',
    deniedTheme: 'The mark is absent. The matter lacks the distinguishing quality needed to succeed in this form. Something essential is missing from the presentation or the timing.',
  },
  {
    number: 6,
    name: "Al-Hanʿa",
    arabic: 'الهَنْعَة',
    stars: 'γ + ξ Geminorum',
    startDegree: 64.285,
    nature: 'malefic',
    element: 'water',
    oracleDescriptor: 'The Brand Mark — what has been sealed cannot be undone',
    oracleVoice: 'al-Qamar moves through Al-Hanʿa — the station of the brand, where decisions made leave permanent impressions. This is not a station of lightness. What is initiated here carries weight into the future.',
    confirmedTheme: 'Confirmed here means a lasting commitment is being sealed. The matter will endure. The seeker should enter only if they intend to remain.',
    deniedTheme: 'The denial here is a mercy — it prevents a commitment that would have become a burden. What is blocked now frees the seeker from a mark they would not want to carry.',
  },
  {
    number: 7,
    name: 'Al-Dhirāʿ',
    arabic: 'الذِّرَاع',
    stars: 'Castor + Pollux — α + β Geminorum',
    startDegree: 77.142,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: 'The Forearm — strength extended toward what is reached for',
    oracleVoice: 'al-Qamar rests in Al-Dhirāʿ — the station of the outstretched arm, where effort meets what it has been reaching toward. The twins Castor and Pollux witness together: this is a station of partnership, cooperation, and mutual arrival.',
    confirmedTheme: 'What is confirmed comes through another — a partner, a collaborator, a bridge between the seeker and the destination. Do not attempt this alone.',
    deniedTheme: 'The arm reaches but finds no grip. Either the timing is wrong or the partnership needed is not yet formed. Come back when the other hand is ready to meet yours.',
  },
  {
    number: 8,
    name: 'Al-Nathra',
    arabic: 'النَّثْرَة',
    stars: 'Praesepe cluster — Cancer',
    startDegree: 90,
    nature: 'benefic',
    element: 'water',
    oracleDescriptor: 'The Tip of the Nose — instinct leading before the mind',
    oracleVoice: "al-Qamar dwells in Al-Nathra — the station of the breath and the nose, where what the soul senses precedes what the mind calculates. The Praesepe — the beehive cluster — hums quietly here. Trust is the intelligence of this station.",
    confirmedTheme: "The confirmation is felt before it is understood. The seeker's instinct has been correct. Trust what has been sensed without evidence.",
    deniedTheme: "Something does not smell right — and the denial confirms what the body already knew. The seeker has been ignoring an inner signal. This is the moment to listen to it.",
  },
  {
    number: 9,
    name: 'Al-Ṭarf',
    arabic: 'الطَّرْف',
    stars: 'κ Cancri + λ Leonis',
    startDegree: 102.857,
    nature: 'malefic',
    element: 'water',
    oracleDescriptor: 'The Glance — what is seen from the corner of the eye',
    oracleVoice: 'al-Qamar passes through Al-Ṭarf — the station of the glance, the eye that catches movement at the periphery. What is most important in this moment is not at the center of attention. The answer lives at the edge of what is being looked at.',
    confirmedTheme: 'Confirmed, but through an unexpected angle. The seeker should look away from the obvious path — the opening is peripheral, not central.',
    deniedTheme: 'What is being stared at directly will not open. The intensity of focus is itself the obstruction. Release the gaze and something else will emerge.',
  },
  {
    number: 10,
    name: 'Al-Jabha',
    arabic: 'الجَبْهَة',
    stars: 'α + η + γ + ζ Leonis',
    startDegree: 115.714,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: "The Forehead — authority, confrontation, the lion's brow",
    oracleVoice: "al-Qamar stands in Al-Jabha — the station of the lion's forehead, where authority is both tested and granted. This is not a gentle station. What is faced here must be faced directly, without deflection.",
    confirmedTheme: "Confirmed through strength, not softness. The seeker has earned what is opening through their willingness to face what others turn away from. Stand tall in what arrives.",
    deniedTheme: "The lion's brow blocks passage. There is an authority or a confrontation that has not been faced honestly. The denial asks for courage before the door will move.",
  },
  {
    number: 11,
    name: 'Al-Zubra',
    arabic: 'الزُّبْرَة',
    stars: 'δ + θ Leonis',
    startDegree: 128.571,
    nature: 'benefic',
    element: 'fire',
    oracleDescriptor: "The Mane — dignity in motion, pride as protection",
    oracleVoice: "al-Qamar rests in Al-Zubra — the station of the lion's mane, where dignity is both armor and invitation. What carries itself with quiet authority in this station draws what it seeks toward it rather than chasing.",
    confirmedTheme: 'Confirmed with dignity. What arrives will arrive with honor. The seeker should receive it standing, not running.',
    deniedTheme: 'The denial is about dignity — either the approach has lacked it, or the matter itself does not carry the honor it claims. Pride must be examined before the path opens.',
  },
  {
    number: 12,
    name: 'Al-Ṣarfa',
    arabic: 'الصَّرْفَة',
    stars: 'Denebola — β Leonis',
    startDegree: 141.428,
    nature: 'malefic',
    element: 'earth',
    oracleDescriptor: 'The Changer — the turning of weather, the turn of tide',
    oracleVoice: 'al-Qamar moves through Al-Ṣarfa — the station of the turn, where the Arabs marked the shift from cold to warmth. Everything in this station is in the act of becoming something else. The old form is dissolving. The new has not yet arrived.',
    confirmedTheme: 'Confirmed in the middle of a transition. What is opening is part of a larger change the seeker is already inside. Welcome the turning — it is in your favor.',
    deniedTheme: 'The tide is turning against this matter. What was possible in the previous season has passed. This is not failure — it is timing. The next turn will be different.',
  },
  {
    number: 13,
    name: "Al-ʿAwwāʾ",
    arabic: 'العَوَّاء',
    stars: 'β + η + γ + δ + ε Virginis',
    startDegree: 154.285,
    nature: 'benefic',
    element: 'earth',
    oracleDescriptor: 'The Barking Dog — alert vigilance, the guardian at the gate',
    oracleVoice: "al-Qamar dwells in Al-ʿAwwāʾ — the station of the barking dog, the guardian whose voice announces what approaches before it arrives. Alertness is the gift of this station. What is coming has already made a sound.",
    confirmedTheme: 'Something is approaching that the seeker has already sensed. Confirmed means it arrives. The inner signal heard recently was accurate. Prepare to receive.',
    deniedTheme: 'The dog barks a warning, not a welcome. What is approaching should be approached with caution or not at all. The guardian is doing its work.',
  },
  {
    number: 14,
    name: 'Al-Simāk',
    arabic: 'السِّمَاك',
    stars: 'Spica — α Virginis',
    startDegree: 167.142,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: "The Unarmed One — Spica, the brightest star of Virgo",
    oracleVoice: "al-Qamar stands in Al-Simāk — the station of Spica, the unarmed one, the brightest lamp in the virgin's hand. This is one of the most auspicious stations. The light here is steady, clear, and generous.",
    confirmedTheme: 'A powerful confirmation. Al-Simāk is among the most favorable stations — what is confirmed here has strong celestial support. The path is not only open, it is lit.',
    deniedTheme: 'Even in denial, Al-Simāk carries grace. The refusal here is not harsh — it is a gentle redirection toward something more aligned. Trust that what is denied is less than what is being preserved.',
  },
  {
    number: 15,
    name: 'Al-Ghafr',
    arabic: 'الغَفْر',
    stars: 'ι + κ + λ Virginis',
    startDegree: 180,
    nature: 'benefic',
    element: 'earth',
    oracleDescriptor: 'The Cover — forgiveness, concealment, the veil of mercy',
    oracleVoice: 'al-Qamar rests in Al-Ghafr — the station of the cover, where what needs to be hidden from harm is hidden, and what needs forgiveness finds it. The root of Ghafr is the same as Ghafūr — the All-Forgiving. Mercy is close.',
    confirmedTheme: 'What is confirmed arrives under protection. The matter has been guarded from harm during the period of waiting. It emerges now intact.',
    deniedTheme: 'The cover descends over this matter for a reason. Something must remain hidden or must heal before it can be exposed to the light of action. Honor the veil.',
  },
  {
    number: 16,
    name: 'Al-Zubānā',
    arabic: 'الزُّبَانَى',
    stars: 'α + β Librae',
    startDegree: 192.857,
    nature: 'malefic',
    element: 'air',
    oracleDescriptor: "The Claws — the scorpion's reach before the sting",
    oracleVoice: "al-Qamar moves through Al-Zubānā — the station of the claws, originally the scorpion's reaching pincers before Libra was separated as its own constellation. What reaches here has not yet decided whether to grasp or release.",
    confirmedTheme: 'Confirmed but with caution — what opens here has an edge. The seeker should move carefully and protect what they value during this opening.',
    deniedTheme: 'The claws close rather than open. What was reached for pulls back or pinches. Withdrawal is not defeat — it is wisdom in the face of something that was not what it appeared.',
  },
  {
    number: 17,
    name: 'Al-Iklīl',
    arabic: 'الإِكْلِيل',
    stars: 'β + δ + π Scorpii',
    startDegree: 205.714,
    nature: 'benefic',
    element: 'water',
    oracleDescriptor: 'The Crown — honor, recognition, the wreath of arrival',
    oracleVoice: "al-Qamar dwells in Al-Iklīl — the station of the crown, the diadem at the scorpion's head. Honor is the theme of this station. What is crowned here is not given lightly — it has been earned through endurance.",
    confirmedTheme: "What arrives comes with recognition. The seeker will be seen and acknowledged as part of this opening. It is not only the matter that is confirmed — it is the seeker's worthiness for it.",
    deniedTheme: 'The crown is withheld because the preparation is not complete. What is denied here is not the destination — it is the timing of the coronation. Continue earning what has been reached for.',
  },
  {
    number: 18,
    name: 'Al-Qalb',
    arabic: 'القَلْب',
    stars: 'Antares — α Scorpii',
    startDegree: 218.571,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: "The Heart — Antares, the heart of the scorpion, rival of Mushtari",
    oracleVoice: "al-Qamar stands in Al-Qalb — the station of the heart, where Antares burns at the scorpion's core. The Arabs named this star Qalb al-ʿAqrab — the heart of the scorpion. What is at the center of a matter is revealed here without softening.",
    confirmedTheme: 'The heart of the matter is confirmed. What arrives here is real, deep, and central — not peripheral. The seeker has asked about the right thing.',
    deniedTheme: 'The heart rejects. The denial here is not about surface details — it goes to the core. Something fundamental in the matter or the intention needs examination before proceeding.',
  },
  {
    number: 19,
    name: 'Al-Shawla',
    arabic: 'الشَّوْلَة',
    stars: 'λ + υ Scorpii',
    startDegree: 231.428,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: "The Sting — the sharp conclusion, what cannot be taken back",
    oracleVoice: "al-Qamar passes through Al-Shawla — the station of the scorpion's sting, where what has been building reaches its sharpest point. Words spoken here, decisions made here, carry their consequences swiftly.",
    confirmedTheme: 'What is confirmed arrives with speed and finality. The waiting is over. What has been gathering force now releases. Act quickly on what opens.',
    deniedTheme: 'The sting is averted. The denial here is a shield — something that would have struck with lasting consequence is being blocked. This refusal protects.',
  },
  {
    number: 20,
    name: "Al-Naʿāʾim",
    arabic: 'النَّعَائِم',
    stars: 'γ + δ + ε + η Sagittarii',
    startDegree: 244.285,
    nature: 'malefic',
    element: 'fire',
    oracleDescriptor: 'The Ostriches — what crosses the river and what returns',
    oracleVoice: 'al-Qamar rests in Al-Naʿāʾim — the station of the ostriches, where the Arabs saw two groups: those crossing the celestial river and those returning. Two currents run simultaneously here. The seeker stands between a going and a coming.',
    confirmedTheme: 'One current is in your favor. The confirmation belongs to the forward movement — cross, do not turn back. What is opening is on the other side.',
    deniedTheme: 'The returning ostriches face you. This is not the crossing — this is the return. What was left behind holds more value than what is being pursued forward.',
  },
  {
    number: 21,
    name: 'Al-Balda',
    arabic: 'البَلْدَة',
    stars: 'Empty sky near π Sagittarii',
    startDegree: 257.142,
    nature: 'benefic',
    element: 'earth',
    oracleDescriptor: 'The Empty Quarter — sacred emptiness, the city of silence',
    oracleVoice: 'al-Qamar moves through Al-Balda — the station of the empty quarter, where no bright star marks the sky and the darkness itself becomes the sign. The Arabs called this the city. Sometimes the most sacred space holds nothing visible.',
    confirmedTheme: 'What is confirmed arrives in stillness, not spectacle. The opening is quiet. The seeker who expects celebration will miss it. Look for the subtle door.',
    deniedTheme: 'The emptiness is the answer. There is genuinely nothing here for this matter at this time. The station counsels release rather than pursuit.',
  },
  {
    number: 22,
    name: 'Saʿd al-Dhābiḥ',
    arabic: 'سَعْد الذَّابِح',
    stars: 'α + β Capricorni',
    startDegree: 270,
    nature: 'benefic',
    element: 'earth',
    oracleDescriptor: 'The Lucky Star of the Slaughterer — fortunate sacrifice, sacred release',
    oracleVoice: "al-Qamar dwells in Saʿd al-Dhābiḥ — the fortunate star of the one who slaughters, where sacrifice leads to sustenance. What is released here feeds what follows. The letting go is not loss — it is the condition of the blessing.",
    confirmedTheme: 'Confirmed through release. Something must be given up as part of receiving what is opening. The sacrifice is small relative to what arrives. Do not hold the old thing while reaching for the new.',
    deniedTheme: 'The sacrifice has not been made. Something is being held onto that is blocking the current. The denial asks: what are you unwilling to release?',
  },
  {
    number: 23,
    name: 'Saʿd Bulaʿ',
    arabic: 'سَعْد بُلَع',
    stars: 'ν + μ Aquarii',
    startDegree: 282.857,
    nature: 'benefic',
    element: 'water',
    oracleDescriptor: 'The Lucky Star of the Swallower — absorption, internalization, deep taking-in',
    oracleVoice: 'al-Qamar stands in Saʿd Bulaʿ — the fortunate star of the swallower, where what is received is taken deep inside rather than displayed. The blessing of this station works from within. It cannot be seen immediately from outside.',
    confirmedTheme: 'What is confirmed will not look like success to others immediately. It will be felt internally first. Trust the internal shift before the external evidence arrives.',
    deniedTheme: 'What is sought cannot be absorbed — it is incompatible with what the seeker is already carrying inside. An inner clearing is needed before this can be taken in.',
  },
  {
    number: 24,
    name: 'Saʿd al-Suʿūd',
    arabic: 'سَعْد السُّعُود',
    stars: 'β Aquarii',
    startDegree: 295.714,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: 'The Luckiest of the Lucky — the most auspicious station of all',
    oracleVoice: "al-Qamar rests in Saʿd al-Suʿūd — the luckiest of the lucky stars, where the Arabs saw the greatest concentration of celestial fortune. al-Qamar here is bathed in the most generous light the sky offers.",
    confirmedTheme: 'Among the strongest confirmations in the manāzil. What is confirmed under Saʿd al-Suʿūd carries exceptional celestial support. Receive with gratitude — this is a rare alignment.',
    deniedTheme: 'Even in denial, Saʿd al-Suʿūd softens the refusal. What is blocked here is being redirected toward something better, not simply closed. The luck of this station does not disappear — it changes form.',
  },
  {
    number: 25,
    name: 'Saʿd al-Akhbiya',
    arabic: 'سَعْد الأَخْبِيَة',
    stars: 'γ + π + ζ + η Aquarii',
    startDegree: 308.571,
    nature: 'malefic',
    element: 'water',
    oracleDescriptor: 'The Lucky Star of the Hidden Tents — fortune concealed from plain sight',
    oracleVoice: "al-Qamar moves through Saʿd al-Akhbiya — the fortunate star of the hidden tents, where fortune exists but cannot be approached directly. The tents are there, but their doors face away. The blessing must be approached from an unexpected angle.",
    confirmedTheme: "Confirmed but hidden. What is opening is not visible yet from the seeker's current position. Move around the situation — approach from a different direction than the one being tried.",
    deniedTheme: 'The tents are closed against this approach. The matter carries fortune in principle but the current method of pursuit is wrong. The goal may be right while the path is entirely wrong.',
  },
  {
    number: 26,
    name: 'Al-Fargh al-Awwal',
    arabic: 'الفَرْغ الأَوَّل',
    stars: 'α + β Pegasi',
    startDegree: 321.428,
    nature: 'benefic',
    element: 'air',
    oracleDescriptor: 'The First Spout — the first outpouring, what begins to flow',
    oracleVoice: 'al-Qamar dwells in Al-Fargh al-Awwal — the station of the first spout, where what has been contained begins to pour. The great square of Pegasus holds this station — the celestial vessel tilting toward release.',
    confirmedTheme: 'What is confirmed is the beginning of a flow that will continue. This is not a single event — it is the opening of a sustained current. What arrives now is the first of more.',
    deniedTheme: 'The vessel tilts but nothing pours. The container is either empty or blocked. Replenishment must happen before anything can flow from this direction.',
  },
  {
    number: 27,
    name: 'Al-Fargh al-Thānī',
    arabic: 'الفَرْغ الثَّانِي',
    stars: 'γ Pegasi + α Andromedae',
    startDegree: 334.285,
    nature: 'benefic',
    element: 'water',
    oracleDescriptor: 'The Second Spout — sustained outpouring, the flow continues',
    oracleVoice: 'al-Qamar stands in Al-Fargh al-Thānī — the station of the second spout, where the pouring that began in the first station now flows fully. What the first opened, the second sustains. The current is now continuous.',
    confirmedTheme: 'Sustained confirmation. This is not a brief opening — what arrives now has staying power. The seeker need not rush or grasp — there is enough and it continues.',
    deniedTheme: 'The second spout runs dry before the first has properly filled. Something was used or depleted before it was ready to give. Rest and replenishment are needed before this can flow.',
  },
  {
    number: 28,
    name: 'Baṭn al-Ḥūt',
    arabic: 'بَطْن الحُوت',
    stars: 'β Andromedae',
    startDegree: 347.142,
    nature: 'benefic',
    element: 'water',
    oracleDescriptor: 'The Belly of the Fish — containment before transformation',
    oracleVoice: 'al-Qamar completes its journey in Baṭn al-Ḥūt — the belly of the fish, the final station before the cycle begins again. As Yūnus rested in the belly of the great fish before his emergence and mission, what rests here is being prepared for something larger than what was asked.',
    confirmedTheme: 'What is confirmed here is larger than the question. The seeker asked about one thing but the opening carries a transformation that exceeds the original intention. Be prepared for more than was sought.',
    deniedTheme: 'The denial here is the belly — containment, not rejection. Like Yūnus, what is held here is being held for purpose, not for punishment. The emergence is coming, but it requires the full time of the holding.',
  },
];

/**
 * Get the manzila for a given sidereal Moon longitude.
 * Each manzila spans 360/28 = 12.857142857 degrees.
 */
export function getManzila(moonLongitude: number): Manzila {
  const normalized = ((moonLongitude % 360) + 360) % 360;
  const index = Math.floor(normalized / (360 / 28));
  return MANAZIL_AL_QAMAR[Math.min(index, 27)]!;
}

/**
 * Build the full oracle injection line for the Opus system prompt.
 * Verdict-aware — passes the correct theme so Opus knows the
 * emotional direction of this station tonight.
 */
export function getManzilaOracleLine(
  moonLongitude: number,
  verdict: 'CONFIRMED' | 'DENIED',
): string {
  const m = getManzila(moonLongitude);
  const theme = verdict === 'CONFIRMED' ? m.confirmedTheme : m.deniedTheme;
  return `${m.oracleVoice}\n${theme}`;
}

/**
 * Get display-safe fields for the UI card.
 * Returns only what the frontend needs — no oracle machinery exposed.
 */
export function getManzilaDisplay(moonLongitude: number): {
  name: string;
  arabic: string;
  descriptor: string;
  number: number;
} {
  const m = getManzila(moonLongitude);
  return {
    name: m.name,
    arabic: m.arabic,
    descriptor: m.oracleDescriptor,
    number: m.number,
  };
}
