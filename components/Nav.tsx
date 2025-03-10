import React from "react";

import KFLogo from "./icons/KFLogo";
import Refresh from "./icons/Refresh";
import Image from "next/image";

export default function Nav({ refreshChat }: { refreshChat: () => void }) {
  return (
    <div
      className={`flex justify-between items-center bg-gradient-to-r from-secondary to-primary rounded p-4`}
    >
      <Image height={40} width={224} src="/kf-logo.png" alt="" />
      {/* <KFLogo className={`fill-white`} /> */}
      <button className="cursor-pointer" onClick={refreshChat}>
        <Refresh className="w-10 h-10 stroke-white rounded transition duration-150 hocus:stroke-secondary hocus:bg-white" />
        {/* <Image height={20} width={20} onClick={closeFrame} src='/cancel.svg'/> */}
      </button>
    </div>
  );
}
