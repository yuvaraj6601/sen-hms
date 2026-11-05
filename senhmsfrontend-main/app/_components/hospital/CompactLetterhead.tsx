import { HOSPITAL } from "@/app/_lib/hospital-config";
import Image from "next/image";

interface CompactLetterheadProps {
  className?: string;
}

export default function CompactLetterhead({ className = "" }: CompactLetterheadProps) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 border-b border-gray-200 ${className}`}>
      <Image
        src={HOSPITAL.logo}
        alt="SEN Hospitals"
        width={40}
        height={32}
        className="flex-shrink-0"
      />

      <div className="text-center flex-1 px-2">
        <h2 className="text-sm font-bold text-indigo-900 leading-tight">{HOSPITAL.fullName}</h2>
        <p className="text-[9px] font-semibold text-gray-600 leading-tight">{HOSPITAL.tagline}</p>
        <p className="text-[8px] text-gray-500 leading-tight mt-0.5">{HOSPITAL.address}</p>
        <p className="text-[8px] text-gray-500 leading-tight">Tel: {HOSPITAL.phones.join(", ")}</p>
      </div>

      <Image
        src={HOSPITAL.seal}
        alt="NABH Pre Accredited"
        width={32}
        height={32}
        className="flex-shrink-0"
      />
    </div>
  );
}