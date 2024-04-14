import type { KeyColor, CustomKeyProps } from 'types';
import 'presets/realistic.css';

const WhiteKey = (props: CustomKeyProps) => {
  const { innerProps, active } = props;
  const className = buildClassName('white', active);

  return <div {...innerProps} className={className} />;
};

const BlackKey = (props: CustomKeyProps) => {
  const { innerProps, active } = props;
  const className = buildClassName('black', active);
  const state = active ? 'active' : 'default';
  const SVG = blackKeyVariants[state];

  return (
    <div {...innerProps} className={className}>
      <svg
        viewBox="0 0 38 253"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="klavier-realistic-key-svg"
      >
        {SVG}
      </svg>
    </div>
  );
};

const blackKeyVariants = {
  default: (
    <>
      <path d="M0 0H38V251C38 252.105 37.1046 253 36 253H2C0.89543 253 0 252.105 0 251V0Z" fill="black" />
      <path
        d="M3 0C4.10457 0 5 0.895431 5 2V250.5C5 250.776 4.77614 251 4.5 251C3.67157 251 3 250.328 3 249.5V0Z"
        fill="url(#paint0_linear_17_219)"
      />
      <path
        d="M3 0C4.10457 0 5 0.895431 5 2V250.5C5 250.776 4.77614 251 4.5 251C3.67157 251 3 250.328 3 249.5V0Z"
        fill="url(#paint1_linear_17_219)"
        fillOpacity="0.2"
      />
      <path
        d="M33 2C33 0.895431 33.8954 0 35 0V249.5C35 250.328 34.3284 251 33.5 251C33.2239 251 33 250.776 33 250.5V2Z"
        fill="url(#paint2_linear_17_219)"
      />
      <path d="M32.5349 215.5L34.9625 249H3.03754L5.46508 215.5H32.5349Z" fill="#242424" stroke="#191919" />
      <g filter="url(#filter0_f_17_219)">
        <path d="M7 233.5L6 219.5L15 216V235.5L7 233.5Z" fill="white" fillOpacity="0.8" />
      </g>
      <g filter="url(#filter1_f_17_219)">
        <path d="M25.5 234V224.5H31.5L32 233.5L25.5 234Z" fill="white" fillOpacity="0.1" />
      </g>
      <path
        d="M5.5 0.5H32.5V214C32.5 219.247 28.2467 223.5 23 223.5H15C9.7533 223.5 5.5 219.247 5.5 214V0.5Z"
        fill="url(#paint3_linear_17_219)"
        stroke="#303030"
      />
      <path
        d="M4.16122 233.813C4.76613 228.369 9.36782 224.25 14.8455 224.25H23.1545C28.6322 224.25 33.2339 228.369 33.8388 233.813L35.5048 248.807C35.6199 249.843 34.8085 250.75 33.7655 250.75H4.23453C3.19151 250.75 2.38005 249.843 2.49523 248.807L4.16122 233.813Z"
        fill="url(#paint4_linear_17_219)"
        stroke="url(#paint5_linear_17_219)"
        strokeWidth="0.5"
      />
      <defs>
        <filter
          id="filter0_f_17_219"
          x="2"
          y="212"
          width="17"
          height="27.5"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_17_219" />
        </filter>
        <filter
          id="filter1_f_17_219"
          x="21.5"
          y="220.5"
          width="14.5"
          height="17.5"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_17_219" />
        </filter>
        <linearGradient id="paint0_linear_17_219" x1="3" y1="134.5" x2="5" y2="134.5" gradientUnits="userSpaceOnUse">
          <stop />
          <stop offset="1" stopColor="#595959" />
        </linearGradient>
        <linearGradient id="paint1_linear_17_219" x1="3" y1="101" x2="4" y2="205" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="paint2_linear_17_219" x1="33" y1="134.5" x2="35" y2="134.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4D4C4C" />
          <stop offset="1" />
        </linearGradient>
        <linearGradient id="paint3_linear_17_219" x1="19" y1="0" x2="19" y2="232" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B2B2B" />
          <stop offset="0.169631" stopColor="#333333" />
          <stop offset="0.477647" stopColor="#474748" />
          <stop offset="0.766044" stopColor="#4F4F4F" />
          <stop offset="1" stopColor="#3D3D3D" />
        </linearGradient>
        <linearGradient id="paint4_linear_17_219" x1="19" y1="228.5" x2="19" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#070707" />
          <stop offset="0.816181" stopColor="#3B3B3B" />
          <stop offset="1" stopColor="#464646" />
        </linearGradient>
        <linearGradient
          id="paint5_linear_17_219"
          x1="16.5"
          y1="249"
          x2="5.99999"
          y2="236"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#191919" />
          <stop offset="1" stopColor="#434343" />
        </linearGradient>
      </defs>
    </>
  ),
  active: (
    <>
      <path d="M0 0H38V251C38 252.105 37.1046 253 36 253H2C0.89543 253 0 252.105 0 251V0Z" fill="black" />
      <path
        d="M4 0C4.55228 0 5 0.447715 5 1V250.75C5 250.888 4.88807 251 4.75 251C4.33579 251 4 250.664 4 250.25V0Z"
        fill="url(#paint0_linear_26_448)"
      />
      <path
        d="M4 0C4.55228 0 5 0.447715 5 1V250.75C5 250.888 4.88807 251 4.75 251C4.33579 251 4 250.664 4 250.25V0Z"
        fill="url(#paint1_linear_26_448)"
        fillOpacity="0.2"
      />
      <path
        d="M33 1.00001C33 0.447723 33.4477 0 34 0V250.25C34 250.664 33.6642 251 33.25 251C33.1119 251 33 250.888 33 250.75V1.00001Z"
        fill="url(#paint2_linear_26_448)"
      />
      <path d="M33.5211 224.5L34.5779 249H3.42194L4.47885 224.5H33.5211Z" fill="#242424" stroke="#191919" />
      <g filter="url(#filter0_f_26_448)">
        <path d="M7 246.5L6 232.5L15 229V248.5L7 246.5Z" fill="white" fillOpacity="0.8" />
      </g>
      <g filter="url(#filter1_f_26_448)">
        <path d="M27.5 248V238.5H33.5L34 247.5L27.5 248Z" fill="white" fillOpacity="0.1" />
      </g>
      <path
        d="M4.54255 225.96L5.49789 0.5H32.5021L33.4575 225.96C33.4797 231.222 29.22 235.5 23.9575 235.5H14.0425C8.78003 235.5 4.52025 231.222 4.54255 225.96Z"
        fill="url(#paint3_linear_26_448)"
        stroke="#303030"
      />
      <path
        d="M3.4766 244.892C4.48156 239.867 8.89352 236.25 14.0178 236.25H23.9822C29.1065 236.25 33.5184 239.867 34.5234 244.892L35.2764 248.657C35.493 249.74 34.6647 250.75 33.5604 250.75H4.43961C3.33528 250.75 2.50701 249.74 2.72359 248.657L3.4766 244.892Z"
        fill="url(#paint4_linear_26_448)"
        stroke="url(#paint5_linear_26_448)"
        strokeWidth="0.5"
      />
      <defs>
        <filter
          id="filter0_f_26_448"
          x="2"
          y="225"
          width="17"
          height="27.5"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_26_448" />
        </filter>
        <filter
          id="filter1_f_26_448"
          x="23.5"
          y="234.5"
          width="14.5"
          height="17.5"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="2" result="effect1_foregroundBlur_26_448" />
        </filter>
        <linearGradient id="paint0_linear_26_448" x1="3" y1="134.5" x2="5" y2="134.5" gradientUnits="userSpaceOnUse">
          <stop />
          <stop offset="1" stopColor="#595959" />
        </linearGradient>
        <linearGradient id="paint1_linear_26_448" x1="3" y1="101" x2="4" y2="205" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="paint2_linear_26_448" x1="33" y1="134.5" x2="35" y2="134.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4D4C4C" />
          <stop offset="1" />
        </linearGradient>
        <linearGradient id="paint3_linear_26_448" x1="19" y1="0" x2="19" y2="232" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1F1F1F" />
          <stop offset="0.766044" stopColor="#383838" />
          <stop offset="1" stopColor="#242424" />
        </linearGradient>
        <linearGradient id="paint4_linear_26_448" x1="19" y1="228.5" x2="19" y2="250" gradientUnits="userSpaceOnUse">
          <stop stopColor="#070707" />
          <stop offset="0.816181" stopColor="#3B3B3B" />
          <stop offset="1" stopColor="#464646" />
        </linearGradient>
        <linearGradient id="paint5_linear_26_448" x1="16.5" y1="249" x2="6" y2="236" gradientUnits="userSpaceOnUse">
          <stop stopColor="#191919" />
          <stop offset="1" stopColor="#434343" />
        </linearGradient>
      </defs>
    </>
  ),
};

const classNames = {
  black: 'klavier-realistic-key-black',
  white: 'klavier-realistic-key-white',
};

function buildClassName(color: KeyColor, active: boolean) {
  const baseClass = classNames[color];
  return active ? `${baseClass} active` : baseClass;
}

export const realistic = {
  blackKey: BlackKey,
  whiteKey: WhiteKey,
};
