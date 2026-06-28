export const REJECT_ALL_PATTERNS: RegExp[] = [
  // English
  /^reject all$/i,
  /^decline all$/i,
  /^decline all cookies$/i,
  /^decline all optional cookies$/i,
  /^decline non-essential cookies$/i,
  /^decline non essential cookies$/i,
  /^refuse all$/i,
  /^deny all$/i,
  /^reject optional cookies$/i,
  /^decline optional cookies$/i,
  /^only (use )?essential cookies$/i,
  /^essential cookies only$/i,
  /^only necessary cookies$/i,
  /^necessary cookies only$/i,
  /^use necessary cookies only$/i,
  /^continue without accepting$/i,
  /^continue without consent$/i,

  // Irish / UK variants
  /^reject all cookies$/i,
  /^decline all cookies$/i,

  // French
  /^tout refuser$/i,
  /^refuser tout$/i,
  /^continuer sans accepter$/i,
  /^cookies essentiels uniquement$/i,

  // German
  /^alle ablehnen$/i,
  /^ablehnen$/i,
  /^nur notwendige cookies$/i,
  /^nur erforderliche cookies$/i,

  // Spanish
  /^rechazar todo$/i,
  /^rechazar todas$/i,
  /^solo cookies necesarias$/i,

  // Italian
  /^rifiuta tutto$/i,
  /^rifiuta tutti$/i,
  /^solo cookie necessari$/i,

  // Dutch
  /^alles weigeren$/i,
  /^weiger alles$/i,
  /^alleen noodzakelijke cookies$/i,

  // Portuguese
  /^rejeitar tudo$/i,
  /^recusar tudo$/i,

  // Polish
  /^odrzuć wszystkie$/i,
  /^odrzuc wszystkie$/i,
  /^tylko niezbedne pliki cookie$/i,

  // Swedish / Danish / Norwegian
  /^avvisa alla$/i,
  /^afvis alle$/i,
  /^avslå alle$/i,

  // Czech / Slovak
  /^odmitnout vse$/i,
  /^odmietnut vsetko$/i,
];

export const REJECT_PARTIAL_PATTERNS: RegExp[] = [
  /\bdecline all\b/i,
  /\breject all\b/i,
  /\brefuse all\b/i,
  /\bdeny all\b/i,
  /\bdecline all cookies\b/i,
  /\breject all cookies\b/i,
  /\bdecline optional\b/i,
  /\breject optional\b/i,
];

export const PREFERENCES_BUTTON_PATTERNS: RegExp[] = [
  /^cookie settings$/i,
  /^cookies settings$/i,
  /^manage cookies$/i,
  /^manage preferences$/i,
  /^cookie preferences$/i,
  /^customize$/i,
  /^customise$/i,
  /^preferences$/i,
  /^more options$/i,
  /^show details$/i,
  /^view details$/i,
  /^let me choose$/i,
  /^settings$/i,
];

export const LEGITIMATE_INTEREST_PATTERNS: RegExp[] = [
  /^reject all legitimate interest$/i,
  /^object to all$/i,
  /^opt out of all$/i,
  /^switch off all$/i,
  /^disable all$/i,
  /^turn off all$/i,
  /^withdraw all$/i,
  /^refuse legitimate interest$/i,
  /^deny legitimate interest$/i,
  /^tout desactiver$/i,
  /^alle abschalten$/i,
  /^desactivar todo$/i,
  /^disattiva tutto$/i,
];

export const LEGITIMATE_INTEREST_CONTEXT_PATTERN =
  /legitimate interest|licit[i]mate interest|interest l[eé]gitime|berechtigtes interesse|inter[eê]s leg[ií]timo|interesse legittimo|gerechtvaardigd belang|legitima finalidad|interes legitimo/i;

export const SAVE_CHOICES_PATTERNS: RegExp[] = [
  /^save (my )?choices$/i,
  /^save preferences$/i,
  /^confirm (my )?choices$/i,
  /^confirm selection$/i,
  /^apply$/i,
  /^save and exit$/i,
  /^enregistrer mes choix$/i,
  /^speichern$/i,
  /^guardar preferencias$/i,
  /^salva preferenze$/i,
  /^opslaan$/i,
];

export const ACCEPT_PATTERNS: RegExp[] = [
  /^accept all$/i,
  /^allow all$/i,
  /^agree$/i,
  /^i agree$/i,
  /^accept cookies$/i,
  /^got it$/i,
  /^ok$/i,
  /^okay$/i,
];
