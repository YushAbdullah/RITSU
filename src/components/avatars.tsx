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
    <svg className="toon" viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="Cartoon portrait of Adina: modern blue hijab and round owl glasses">
      <defs><clipPath id="toon-clip-a"><circle cx="60" cy="60" r="58" /></clipPath></defs>
      <circle cx="60" cy="60" r="58" fill="#DDEEFF" />
      <path className="toon-spark" d="M98 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFC94D" />
      <g clipPath="url(#toon-clip-a)"><g className="toon-bob toon-bob-late">
        {/* cream top */}
        <path d="M18 122c0-22 18-33 42-33s42 11 42 33z" fill="#F4EFE6" />
        {/* modern hijab: soft voluminous crown wrapping the face */}
        <path d="M60 20c-21 0-31 17-30 38 1 19 9 32 30 37 21-5 29-18 30-37 1-21-9-38-30-38z" fill="#3B82E0" />
        <path d="M46 28c5-4 10-5.5 16-5.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
        {/* face */}
        <ellipse cx="60" cy="63" rx="19" ry="21" fill="#E6B48F" />
        {/* light under-scarf band at the forehead */}
        <path d="M40.5 58c2-12 9.5-18 19.5-18s17.5 6 19.5 18c-5-4.5-11.5-6.5-19.5-6.5s-14.5 2-19.5 6.5z" fill="#BFD9FF" />
        <path d="M42 56.5c5-4 11-5.8 18-5.8s13 1.8 18 5.8" fill="none" stroke="#3B82E0" strokeWidth="1.6" strokeLinecap="round" />
        {/* asymmetric drape across the chin and over one shoulder */}
        <path d="M84 70c-3 14-13 24-30 28-9 2-17 7-21 24h26c2-10 9-15 18-19 11-5 16-16 15-28z" fill="#2F6FCB" />
        <path className="toon-hair" d="M80 80c-5 10-13 16-24 19M86 88c-4 8-10 12-18 15" fill="none" stroke="#2A63B8" strokeWidth="2.4" strokeLinecap="round" />
        {/* pearl pin */}
        <circle cx="82" cy="68" r="3" fill="#FFF6E0" stroke="#E3C27A" strokeWidth="1.2" />
        {/* round owl glasses */}
        <g fill="rgba(255,255,255,0.22)" stroke="#262828" strokeWidth="2.6">
          <circle cx="51" cy="64" r="8" /><circle cx="69" cy="64" r="8" />
        </g>
        <path d="M59 63.5q1-1.4 2 0" fill="none" stroke="#262828" strokeWidth="2.4" strokeLinecap="round" />
        <path className="toon-glint" d="M46.5 60l2.6-2.6M64.5 60l2.6-2.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        {/* eyes */}
        <g className="toon-eyes" fill="#1B1410"><ellipse cx="51" cy="65" rx="2.3" ry="2.9" /><ellipse cx="69" cy="65" rx="2.3" ry="2.9" /></g>
        {/* cheeks + smile */}
        <circle cx="47.5" cy="75" r="3.2" fill="#F28B82" opacity="0.55" /><circle cx="72.5" cy="75" r="3.2" fill="#F28B82" opacity="0.55" />
        <path d="M54 76q6 6 12 0" fill="none" stroke="#7A2E2A" strokeWidth="2.6" strokeLinecap="round" />
      </g></g>
    </svg>
  );
}
