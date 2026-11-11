// Cartoon portraits of the Ritsu team, drawn in SVG with gentle idle animation (bob, blink, wave of the hair).

export function YusriAvatar({ size = 120 }: { size?: number }) {
  return (
    <svg className="toon" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Cartoon portrait of Yusri: curly hair and glasses">
      <defs><clipPath id="toon-clip-y"><circle cx="60" cy="60" r="58" /></clipPath></defs>
      <circle cx="60" cy="60" r="58" fill="#6BE683" />
      <g clipPath="url(#toon-clip-y)"><g className="toon-bob">
        {/* shirt */}
        <path d="M22 120c2-22 18-32 38-32s36 10 38 32z" fill="#262828" />
        <path d="M52 89l8 9 8-9" fill="none" stroke="#6BE683" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* neck + face */}
        <rect x="52" y="74" width="16" height="16" rx="6" fill="#B97E5B" />
        <ellipse cx="60" cy="58" rx="25" ry="27" fill="#C98E6B" />
        <ellipse cx="35" cy="60" rx="4.5" ry="6" fill="#C98E6B" />
        <ellipse cx="85" cy="60" rx="4.5" ry="6" fill="#C98E6B" />
        {/* curly hair */}
        <g className="toon-hair" fill="#2B1E16">
          <circle cx="38" cy="42" r="9" /><circle cx="46" cy="32" r="10" /><circle cx="58" cy="28" r="11" />
          <circle cx="71" cy="30" r="10" /><circle cx="81" cy="38" r="9" /><circle cx="85" cy="48" r="7" />
          <circle cx="35" cy="51" r="6.5" /><circle cx="52" cy="38" r="7" /><circle cx="66" cy="37" r="7" />
        </g>
        {/* glasses */}
        <g fill="rgba(255,255,255,0.18)" stroke="#262828" strokeWidth="2.6">
          <circle cx="49" cy="60" r="8.5" /><circle cx="71" cy="60" r="8.5" />
        </g>
        <path d="M57.5 59.5q2.5-2 5 0" fill="none" stroke="#262828" strokeWidth="2.4" strokeLinecap="round" />
        <path className="toon-glint" d="M44 55l3-3M66 55l3-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        {/* eyes */}
        <g className="toon-eyes" fill="#1B1410"><ellipse cx="49" cy="61" rx="2.6" ry="3.2" /><ellipse cx="71" cy="61" rx="2.6" ry="3.2" /></g>
        {/* cheeks + smile */}
        <circle cx="42" cy="71" r="4" fill="#F28B82" opacity="0.55" /><circle cx="78" cy="71" r="4" fill="#F28B82" opacity="0.55" />
        <path d="M52 72q8 8 16 0" fill="#7A2E2A" stroke="#7A2E2A" strokeWidth="2" strokeLinejoin="round" />
        <path d="M54.5 73.2q5.5 2.4 11 0" fill="#fff" />
      </g></g>
    </svg>
  );
}

export function AdinaAvatar({ size = 120 }: { size?: number }) {
  return (
    <svg className="toon" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Cartoon portrait of Adina: blue hijab and glasses">
      <defs><clipPath id="toon-clip-a"><circle cx="60" cy="60" r="58" /></clipPath></defs>
      <circle cx="60" cy="60" r="58" fill="#DDEEFF" />
      <path className="toon-spark" d="M98 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFC94D" />
      <g clipPath="url(#toon-clip-a)"><g className="toon-bob toon-bob-late">
        {/* top + hijab drape */}
        <path d="M16 122c0-24 18-36 44-36s44 12 44 36z" fill="#2F6FCB" />
        <path d="M30 64c0-24 13-40 30-40s30 16 30 40c0 10-3 20-8 26-6 6-14 9-22 9s-16-3-22-9c-5-6-8-16-8-26z" fill="#3B82E0" />
        <path className="toon-hair" d="M40 92c6 6 13 9 20 9s14-3 20-9" fill="none" stroke="#2A63B8" strokeWidth="3" strokeLinecap="round" />
        {/* face */}
        <ellipse cx="60" cy="63" rx="20" ry="22" fill="#E6B48F" />
        {/* inner cap edge */}
        <path d="M39 58c2-12 10-19 21-19s19 7 21 19c-5-4-12-6-21-6s-16 2-21 6z" fill="#2F6FCB" />
        {/* glasses */}
        <g fill="rgba(255,255,255,0.2)" stroke="#262828" strokeWidth="2.4">
          <rect x="42" y="59" width="14" height="11" rx="5" /><rect x="64" y="59" width="14" height="11" rx="5" />
        </g>
        <path d="M56 64q4-2 8 0" fill="none" stroke="#262828" strokeWidth="2.2" strokeLinecap="round" />
        <path className="toon-glint" d="M45 63l3-3M67 63l3-3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        {/* eyes with lashes */}
        <g className="toon-eyes" fill="#1B1410"><ellipse cx="49" cy="65" rx="2.3" ry="2.9" /><ellipse cx="71" cy="65" rx="2.3" ry="2.9" /></g>
        <path d="M45.5 61l-1.6-1.4M74.5 61l1.6-1.4" stroke="#1B1410" strokeWidth="1.5" strokeLinecap="round" />
        {/* cheeks + smile */}
        <circle cx="45" cy="74" r="3.6" fill="#F28B82" opacity="0.55" /><circle cx="75" cy="74" r="3.6" fill="#F28B82" opacity="0.55" />
        <path d="M53.5 75q6.5 6.5 13 0" fill="none" stroke="#7A2E2A" strokeWidth="2.6" strokeLinecap="round" />
      </g></g>
    </svg>
  );
}
