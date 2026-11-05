import { HOSPITAL } from "@/app/_lib/hospital-config";
import Image from "next/image";

interface MediumLetterheadProps {
  formTitle?: string;
  className?: string;
}

export default function MediumLetterhead({ formTitle, className = "" }: MediumLetterheadProps) {
  return (
    <div className={`border-b-2 border-indigo-900 pb-2 ${className}`}>
      <div className="flex items-center justify-between px-4 py-2">
        <Image
          src={HOSPITAL.logo}
          alt="SEN Hospitals"
          width={60}
          height={48}
          className="flex-shrink-0"
        />

        <div className="text-center flex-1 px-3">
          <h1 className="text-lg font-bold text-indigo-900 leading-tight">{HOSPITAL.fullName}</h1>
          <p className="text-[11px] font-semibold text-gray-600 leading-tight">{HOSPITAL.tagline}</p>
          <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{HOSPITAL.address}</p>
          <p className="text-[10px] text-gray-500 leading-tight">
            Tel: {HOSPITAL.phones.join(", ")} &nbsp;|&nbsp; Pharmacy: {HOSPITAL.pharmacy}
          </p>
          <p className="text-[10px] text-gray-500 leading-tight">
            {HOSPITAL.email} &nbsp;|&nbsp; {HOSPITAL.website}
          </p>
          <p className="text-[9px] text-gray-400 leading-tight mt-0.5">
            (Regd. No.: {HOSPITAL.regdNo})
          </p>
        </div>

        <Image
          src={HOSPITAL.seal}
          alt="NABH Pre Accredited"
          width={48}
          height={48}
          className="flex-shrink-0"
        />
      </div>

      {formTitle && (
        <div className="text-center mt-1">
          <span className="inline-block border border-indigo-900 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-indigo-900">
            {formTitle}
          </span>
        </div>
      )}
    </div>
  );
}