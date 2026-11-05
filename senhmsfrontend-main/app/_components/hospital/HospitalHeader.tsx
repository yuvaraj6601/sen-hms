import { HOSPITAL } from "@/app/_lib/hospital-config";
import Image from "next/image";

interface HospitalHeaderProps {
  formTitle?: string;
  className?: string;
}

export default function HospitalHeader({ formTitle, className = "" }: HospitalHeaderProps) {
  return (
    <header className={`w-full border-b-2 border-black pb-2 mb-4 ${className}`}>
      <div className="flex items-center justify-between px-2">
        <div className="flex-shrink-0">
          <Image src={HOSPITAL.logo} alt="SEN Hospitals" width={90} height={70} priority />
        </div>

        <div className="text-center flex-1">
          <h1 className="text-2xl font-bold tracking-wide">{HOSPITAL.fullName.toUpperCase()}</h1>
          <p className="text-sm font-semibold">{HOSPITAL.tagline}</p>
          <p className="text-xs mt-1">{HOSPITAL.address}</p>
          <p className="text-xs">Tel: {HOSPITAL.phones.join(", ")}</p>
          <p className="text-xs">Pharmacy: {HOSPITAL.pharmacy}</p>
          <p className="text-xs">
            Email: {HOSPITAL.email} &nbsp;|&nbsp; {HOSPITAL.website}
          </p>
          <p className="text-[10px] mt-1">(Regd. No.: {HOSPITAL.regdNo})</p>
        </div>

        <div className="flex-shrink-0">
          <Image src={HOSPITAL.seal} alt="NABH Pre Accredited" width={70} height={70} />
        </div>
      </div>

      {formTitle && (
        <div className="text-center mt-2">
          <span className="inline-block border border-black px-4 py-1 text-sm font-bold uppercase tracking-wider">
            {formTitle}
          </span>
        </div>
      )}
    </header>
  );
}