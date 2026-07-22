import Image from "next/image";
import logo from "@/public/nvg-logo.png";

interface HeaderProps {
  label: string;
}

export const Header = ({}: HeaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Circular white logo container */}
      <div className="flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-2xl ring-4 ring-black/20">
        <Image
          src={logo}
          alt="NVGCHS"
          width={100}
          height={100}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
};
