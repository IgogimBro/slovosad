import { Sprout } from 'lucide-react';
import { Link } from 'react-router-dom';
export function Brand() {
  return (
    <Link className="brand" to="/">
      <span className="brand-icon">
        <Sprout size={27} />
      </span>
      <span>
        словосад<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Owl({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? 'owl small' : 'owl'} viewBox="0 0 260 250" aria-hidden="true">
      <ellipse cx="132" cy="232" rx="73" ry="9" fill="#dce6c9" />
      <path
        d="M72 60L62 21Q96 24 108 43Q138 34 154 43Q187 20 200 22L190 67Q218 98 204 162Q195 219 132 220Q69 218 57 168Q45 101 72 60"
        fill="#749879"
      />
      <path
        d="M75 99Q103 71 131 108Q164 70 191 99L181 167Q169 205 131 205Q89 205 76 166"
        fill="#e6edce"
      />
      <ellipse cx="98" cy="112" rx="33" ry="36" fill="#faf9ef" />
      <ellipse cx="166" cy="112" rx="33" ry="36" fill="#faf9ef" />
      <circle cx="104" cy="113" r="11" fill="#293f36" />
      <circle cx="160" cy="113" r="11" fill="#293f36" />
      <circle cx="108" cy="109" r="3" fill="white" />
      <circle cx="164" cy="109" r="3" fill="white" />
      <path d="M120 131L144 131L132 146Z" fill="#e9ae59" />
      <path
        d="M85 211L78 228M94 214L91 231M174 212L181 229M165 214L169 232"
        stroke="#d49d53"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M57 129Q29 156 50 185Q64 198 80 176" fill="#638669" />
      <path d="M205 127Q233 144 217 175Q208 190 187 177" fill="#638669" />
      <path
        d="M116 162L120 168M142 162L138 168M130 179L132 184"
        stroke="#acbf96"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M36 64Q22 28 10 38Q11 61 36 64" fill="#b4c59d" />
      <path d="M218 57Q249 32 253 47Q243 64 218 57" fill="#b4c59d" />
      <path d="M28 75L19 81M230 76L239 82" stroke="#d7ba7d" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
