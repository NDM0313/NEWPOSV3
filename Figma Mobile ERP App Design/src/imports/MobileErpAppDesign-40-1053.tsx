import svgPaths from "./svg-mxf1k3f4zy";

function Heading1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Heading 2">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Transfer From</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px]">Select source account</p>
    </div>
  );
}

function Container() {
  return (
    <div className="bg-[#1f2937] h-[77.002px] relative rounded-[14px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="content-stretch flex flex-col gap-[7.994px] items-start pb-[0.502px] pt-[16.499px] px-[16.499px] relative size-full">
        <Heading1 />
        <Paragraph />
      </div>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">💵</p>
      </div>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="absolute h-[20.006px] left-0 top-0 w-[120.575px]" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Cash Account</p>
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="absolute h-[16.004px] left-0 top-[20.01px] w-[120.575px]" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[121px]">Balance: Rs. 450,000</p>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[120.575px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph1 />
        <Paragraph2 />
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex gap-[11.996px] h-[36.01px] items-center left-[17.5px] top-[17.5px] w-[156.671px]" data-name="Container">
      <Text />
      <Container1 />
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#1f2937] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container2 />
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">🏦</p>
      </div>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Bank Account - HBL</p>
    </div>
  );
}

function Paragraph4() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[121px]">Balance: Rs. 850,000</p>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[135.01px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph3 />
        <Paragraph4 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[171.107px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[11.996px] items-center relative size-full">
        <Text1 />
        <Container3 />
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[19.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g id="Icon">
          <path d={svgPaths.p40ee300} id="Vector" stroke="var(--stroke-0, #EF4444)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
        </g>
      </svg>
    </div>
  );
}

function Container5() {
  return (
    <div className="absolute content-stretch flex h-[36.01px] items-center justify-between left-[17.5px] top-[17.5px] w-[326.648px]" data-name="Container">
      <Container4 />
      <Icon />
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[rgba(239,68,68,0.2)] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#ef4444] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container5 />
    </div>
  );
}

function Text2() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">🏦</p>
      </div>
    </div>
  );
}

function Paragraph5() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Bank Account - MCB</p>
    </div>
  );
}

function Paragraph6() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[121px]">Balance: Rs. 400,000</p>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[138.831px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph5 />
        <Paragraph6 />
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute content-stretch flex gap-[11.996px] h-[36.01px] items-center left-[17.5px] top-[17.5px] w-[174.927px]" data-name="Container">
      <Text2 />
      <Container6 />
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#1f2937] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container7 />
    </div>
  );
}

function Text3() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">📱</p>
      </div>
    </div>
  );
}

function Paragraph7() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">JazzCash Wallet</p>
    </div>
  );
}

function Paragraph8() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[113px]">Balance: Rs. 25,000</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[112.604px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph7 />
        <Paragraph8 />
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="absolute content-stretch flex gap-[11.996px] h-[36.01px] items-center left-[17.5px] top-[17.5px] w-[148.7px]" data-name="Container">
      <Text3 />
      <Container8 />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#1f2937] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container9 />
    </div>
  );
}

function Text4() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">📱</p>
      </div>
    </div>
  );
}

function Paragraph9() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">EasyPaisa Wallet</p>
    </div>
  );
}

function Paragraph10() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[111px]">Balance: Rs. 15,000</p>
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[113.208px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph9 />
        <Paragraph10 />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="absolute content-stretch flex gap-[11.996px] h-[36.01px] items-center left-[17.5px] top-[17.5px] w-[149.304px]" data-name="Container">
      <Text4 />
      <Container10 />
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[#1f2937] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container11 />
    </div>
  );
}

function Text5() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[24.101px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[32px] left-0 not-italic text-[#f9fafb] text-[24px] top-[-0.49px] tracking-[0.0703px]">💰</p>
      </div>
    </div>
  );
}

function Paragraph11() {
  return (
    <div className="absolute h-[20.006px] left-0 top-0 w-[111.004px]" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Petty Cash</p>
    </div>
  );
}

function Paragraph12() {
  return (
    <div className="absolute h-[16.004px] left-0 top-[20.01px] w-[111.004px]" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px] w-[112px]">Balance: Rs. 10,000</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[36.01px] relative shrink-0 w-[111.004px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph11 />
        <Paragraph12 />
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute content-stretch flex gap-[11.996px] h-[36.01px] items-center left-[17.5px] top-[17.5px] w-[147.1px]" data-name="Container">
      <Text5 />
      <Container12 />
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#1f2937] h-[71.016px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container13 />
    </div>
  );
}

function Container14() {
  return (
    <div className="content-stretch flex flex-col gap-[7.994px] h-[466.067px] items-start relative shrink-0 w-full" data-name="Container">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
      <Button4 />
      <Button5 />
    </div>
  );
}

function AccountTransferFlow() {
  return (
    <div className="absolute bg-[#111827] content-stretch flex flex-col gap-[15.997px] h-[852.567px] items-start left-0 pb-0 pt-[131.974px] px-[15.997px] top-0 w-[393.647px]" data-name="AccountTransferFlow">
      <Container />
      <Container14 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[19.998px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-[20.83%] left-[20.83%] right-1/2 top-[20.83%]" data-name="Vector">
        <div className="absolute inset-[-7.14%_-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.49915 13.3318">
            <path d={svgPaths.p3ec25c00} id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-[20.83%] right-[20.83%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-0.83px_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.3318 1.66648">
            <path d="M12.4986 0.833239H0.833239" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="relative rounded-[10px] shrink-0 size-[35.987px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[7.994px] px-[7.994px] relative size-full">
        <Icon1 />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">Account Transfer</p>
    </div>
  );
}

function Paragraph13() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.8)] top-[0.5px]">Move funds between accounts</p>
    </div>
  );
}

function Container15() {
  return (
    <div className="flex-[1_0_0] h-[39.995px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Heading />
        <Paragraph13 />
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex gap-[11.996px] h-[39.995px] items-center relative shrink-0 w-full" data-name="Container">
      <Button6 />
      <Container15 />
    </div>
  );
}

function Container17() {
  return <div className="bg-white flex-[1_0_0] h-[3.993px] min-h-px min-w-px rounded-[16847700px]" data-name="Container" />;
}

function Container18() {
  return <div className="bg-[rgba(255,255,255,0.3)] flex-[1_0_0] h-[3.993px] min-h-px min-w-px rounded-[16847700px]" data-name="Container" />;
}

function Container19() {
  return (
    <div className="content-stretch flex gap-[7.994px] h-[3.993px] items-center pl-0 pr-[-0.008px] py-0 relative shrink-0 w-full" data-name="Container">
      <Container17 />
      {[...Array(2).keys()].map((_, i) => (
        <Container18 key={i} />
      ))}
    </div>
  );
}

function Paragraph14() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.8)] top-[0.5px] w-[61px]">Step 1 of 3</p>
    </div>
  );
}

function AccountTransferFlow1() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex flex-col from-[#3b82f6] gap-[15.997px] h-[115.977px] items-start left-0 pb-0 pt-[15.997px] px-[15.997px] to-[#2563eb] top-0 w-[393.647px]" data-name="AccountTransferFlow">
      <Container16 />
      <Container19 />
      <Paragraph14 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="absolute left-[193.49px] size-[17.997px] top-[16.99px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.9972 17.9972">
        <g id="Icon">
          <path d="M3.74941 8.99859H14.2478" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49976" />
          <path d={svgPaths.p1a69c140} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49976" />
        </g>
      </svg>
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-gradient-to-b from-[#3b82f6] h-[51.983px] relative rounded-[14px] shrink-0 to-[#2563eb] w-full" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[168.16px] not-italic text-[16px] text-center text-white top-[13px] tracking-[-0.3125px] translate-x-[-50%]">Next</p>
      <Icon2 />
    </div>
  );
}

function AccountTransferFlow2() {
  return (
    <div className="absolute bg-[#1f2937] content-stretch flex flex-col h-[84.478px] items-start left-0 pb-0 pt-[16.499px] px-[15.997px] top-[768.09px] w-[393.647px]" data-name="AccountTransferFlow">
      <div aria-hidden="true" className="absolute border-[#374151] border-solid border-t-[0.502px] inset-0 pointer-events-none" />
      <Button7 />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g id="Icon">
          <path d={svgPaths.p2a11fe00} id="Vector" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
          <path d={svgPaths.p28601a80} id="Vector_2" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
        </g>
      </svg>
    </div>
  );
}

function Text6() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[33.931px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[17px] not-italic text-[#3b82f6] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Home</p>
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[12.34px] top-[-0.5px] w-[65.924px]" data-name="Button">
      <Icon3 />
      <Text6 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g clipPath="url(#clip0_35_295)" id="Icon">
          <path d={svgPaths.p391f5e80} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p4b4c200} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p2fb16300} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
        </g>
        <defs>
          <clipPath id="clip0_35_295">
            <rect fill="white" height="23.9988" width="23.9988" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text7() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[31.162px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[16px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Sales</p>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[86.97px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon4 />
      <Text7 />
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g id="Icon">
          <path d={svgPaths.pc249e80} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p1c067200} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p230ca380} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p161d4800} id="Vector_4" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
        </g>
      </svg>
    </div>
  );
}

function Text8() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[52.226px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[26.5px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Contacts</p>
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[224.36px] top-[-0.5px] w-[84.22px]" data-name="Button">
      <Icon5 />
      <Text8 />
    </div>
  );
}

function Icon6() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g id="Icon">
          <path d={svgPaths.p59dc300} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p1105d880} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p2ab5e0f1} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
        </g>
      </svg>
    </div>
  );
}

function Text9() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[29.412px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[15px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">More</p>
      </div>
    </div>
  );
}

function Button11() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[317.28px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon6 />
      <Text9 />
    </div>
  );
}

function Icon7() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g clipPath="url(#clip0_35_300)" id="Icon">
          <path d={svgPaths.p26ad7760} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
          <path d={svgPaths.pc8f5440} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
          <path d={svgPaths.p90c1000} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
        </g>
        <defs>
          <clipPath id="clip0_35_300">
            <rect fill="white" height="23.9988" width="23.9988" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button12() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex flex-col items-center justify-center left-[159.66px] pb-[0.008px] pt-0 px-0 rounded-[16847700px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[56px] top-[-6.51px]" data-name="Button">
      <Icon7 />
    </div>
  );
}

function BottomNav() {
  return (
    <div className="absolute bg-[#1f2937] border-black border-solid border-t-[0.502px] h-[67.988px] left-0 top-[784.58px] w-[393.647px]" data-name="BottomNav">
      <Button8 />
      <Button9 />
      <Button10 />
      <Button11 />
      <Button12 />
    </div>
  );
}

export default function MobileErpAppDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Mobile ERP App Design">
      <AccountTransferFlow />
      <AccountTransferFlow1 />
      <AccountTransferFlow2 />
      <BottomNav />
    </div>
  );
}