import svgPaths from "./svg-zjm4ngws2q";

function Icon() {
  return (
    <div className="relative shrink-0 size-[19.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g clipPath="url(#clip0_79_285)" id="Icon">
          <path d={svgPaths.p1c1fff80} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.66648" />
          <path d={svgPaths.p3bd12bf8} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.66648" />
        </g>
        <defs>
          <clipPath id="clip0_79_285">
            <rect fill="white" height="19.9977" width="19.9977" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[74.154px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-[rgba(255,255,255,0.8)] top-[0.51px] tracking-[-0.1504px]">Quick Stats</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex gap-[7.994px] h-[20.006px] items-center relative shrink-0 w-full" data-name="Container">
      <Icon />
      <Text />
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.6)] top-[0.5px]">Today</p>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[24px] text-white top-[-0.49px] tracking-[0.0703px]">Rs. 45,000</p>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[51.991px] items-start left-0 top-0 w-[148.826px]" data-name="Container">
      <Paragraph />
      <Paragraph1 />
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.6)] top-[0.5px]">This Week</p>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[24px] text-white top-[-0.49px] tracking-[0.0703px]">Rs. 320,000</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[51.991px] items-start left-[164.82px] top-0 w-[148.834px]" data-name="Container">
      <Paragraph2 />
      <Paragraph3 />
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[51.991px] relative shrink-0 w-full" data-name="Container">
      <Container1 />
      <Container2 />
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-gradient-to-b from-[#3b82f6] h-[135.991px] relative rounded-[16px] shrink-0 to-[#2563eb] w-full" data-name="Container">
      <div className="content-stretch flex flex-col gap-[15.997px] items-start pb-0 pt-[23.999px] px-[23.999px] relative size-full">
        <Container />
        <Container3 />
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Heading 2">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">RECENT SALES</p>
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-[73.338px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">INV-0045</p>
      </div>
    </div>
  );
}

function Text2() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[71.612px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#10b981] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[72px]">Rs. 12,000</p>
      </div>
    </div>
  );
}

function Container5() {
  return (
    <div className="absolute content-stretch flex h-[23.991px] items-center justify-between left-[16.5px] top-[16.5px] w-[328.656px]" data-name="Container">
      <Text1 />
      <Text2 />
    </div>
  );
}

function Text3() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[45.699px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Ahmed</p>
      </div>
    </div>
  );
}

function Text4() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[87.138px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[0.5px]">Today, 2:30 PM</p>
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute content-stretch flex h-[20.006px] items-center justify-between left-[16.5px] top-[48.48px] w-[328.656px]" data-name="Container">
      <Text3 />
      <Text4 />
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#1f2937] h-[84.988px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container5 />
      <Container6 />
    </div>
  );
}

function Text5() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-[73.738px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">INV-0044</p>
      </div>
    </div>
  );
}

function Text6() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[65.006px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#10b981] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[66px]">Rs. 8,500</p>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute content-stretch flex h-[23.991px] items-center justify-between left-[16.5px] top-[16.5px] w-[328.656px]" data-name="Container">
      <Text5 />
      <Text6 />
    </div>
  );
}

function Text7() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[29.098px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Sara</p>
      </div>
    </div>
  );
}

function Text8() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[89.452px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[0.5px]">Today, 11:15 AM</p>
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute content-stretch flex h-[20.006px] items-center justify-between left-[16.5px] top-[48.48px] w-[328.656px]" data-name="Container">
      <Text7 />
      <Text8 />
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#1f2937] h-[84.988px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container7 />
      <Container8 />
    </div>
  );
}

function Text9() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-[73.464px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">INV-0043</p>
      </div>
    </div>
  );
}

function Text10() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[71.408px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#10b981] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[72px]">Rs. 15,200</p>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="absolute content-stretch flex h-[23.991px] items-center justify-between left-[16.5px] top-[16.5px] w-[328.656px]" data-name="Container">
      <Text9 />
      <Text10 />
    </div>
  );
}

function Text11() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[15.981px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Ali</p>
      </div>
    </div>
  );
}

function Text12() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[109.387px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[0.5px]">Yesterday, 4:20 PM</p>
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="absolute content-stretch flex h-[20.006px] items-center justify-between left-[16.5px] top-[48.48px] w-[328.656px]" data-name="Container">
      <Text11 />
      <Text12 />
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#1f2937] h-[84.988px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container9 />
      <Container10 />
    </div>
  );
}

function Text13() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-[73.071px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">INV-0042</p>
      </div>
    </div>
  );
}

function Text14() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[73.495px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#10b981] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[74px]">Rs. 22,000</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="absolute content-stretch flex h-[23.991px] items-center justify-between left-[16.5px] top-[16.5px] w-[328.656px]" data-name="Container">
      <Text13 />
      <Text14 />
    </div>
  );
}

function Text15() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-[42.804px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Fatima</p>
      </div>
    </div>
  );
}

function Text16() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[107.512px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[0.5px]">Yesterday, 1:45 PM</p>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="absolute content-stretch flex h-[20.006px] items-center justify-between left-[16.5px] top-[48.48px] w-[328.656px]" data-name="Container">
      <Text15 />
      <Text16 />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#1f2937] h-[84.988px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container11 />
      <Container12 />
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex flex-col gap-[7.994px] h-[363.937px] items-start relative shrink-0 w-full" data-name="Container">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
    </div>
  );
}

function Button4() {
  return (
    <div className="h-[45.001px] relative rounded-[10px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-[180.61px] not-italic text-[#9ca3af] text-[14px] text-center top-[13px] tracking-[-0.1504px] translate-x-[-50%]">Load More</p>
    </div>
  );
}

function Container14() {
  return (
    <div className="content-stretch flex flex-col gap-[11.996px] h-[456.935px] items-start relative shrink-0 w-full" data-name="Container">
      <Heading1 />
      <Container13 />
      <Button4 />
    </div>
  );
}

function SalesHome() {
  return (
    <div className="absolute bg-[#111827] content-stretch flex flex-col gap-[23.999px] h-[852.567px] items-start left-0 pb-0 pt-[76.476px] px-[15.997px] top-0 w-[393.647px]" data-name="SalesHome">
      <Container4 />
      <Container14 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g id="Icon">
          <path d="M4.99976 11.9994H18.9998" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d="M11.9994 4.99976V18.9998" id="Vector_2" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
        </g>
      </svg>
    </div>
  );
}

function SalesHome1() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex items-center justify-center left-[313.65px] pl-0 pr-[0.008px] py-0 rounded-[16847700px] shadow-[0px_10px_15px_-3px_rgba(59,130,246,0.3),0px_4px_6px_-4px_rgba(59,130,246,0.3)] size-[56px] top-[716.57px]" data-name="SalesHome">
      <Icon1 />
    </div>
  );
}

function Icon2() {
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

function Button5() {
  return (
    <div className="relative rounded-[10px] shrink-0 size-[35.987px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[7.994px] px-[7.994px] relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[27.992px] relative shrink-0 w-[45.464px]" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[28px] left-0 not-italic text-[#f9fafb] text-[18px] top-[0.01px] tracking-[-0.4395px]">Sales</p>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[35.987px] relative shrink-0 w-[93.446px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[11.996px] items-center relative size-full">
        <Button5 />
        <Heading />
      </div>
    </div>
  );
}

function Icon3() {
  return (
    <div className="h-[19.998px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-1/2 left-[20.83%] right-[20.83%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-0.83px_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.3318 1.66648">
            <path d="M0.833239 0.833239H12.4986" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[20.83%] left-1/2 right-1/2 top-[20.83%]" data-name="Vector">
        <div className="absolute inset-[-7.14%_-0.83px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.66648 13.3318">
            <path d="M0.833239 0.833239V12.4986" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="bg-[#3b82f6] relative rounded-[10px] shrink-0 size-[35.987px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[7.994px] px-[7.994px] relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function SalesHome2() {
  return (
    <div className="absolute bg-[#1f2937] content-stretch flex h-[60.48px] items-center justify-between left-0 pb-[0.502px] pt-0 px-[15.997px] top-0 w-[393.647px]" data-name="SalesHome">
      <div aria-hidden="true" className="absolute border-[#374151] border-b-[0.502px] border-solid inset-0 pointer-events-none" />
      <Container15 />
      <Button6 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g id="Icon">
          <path d={svgPaths.p2a11fe00} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
          <path d={svgPaths.p28601a80} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9999" />
        </g>
      </svg>
    </div>
  );
}

function Text17() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[33.931px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[17px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Home</p>
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[12.34px] top-[-0.5px] w-[65.924px]" data-name="Button">
      <Icon4 />
      <Text17 />
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[23.999px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9988 23.9988">
        <g clipPath="url(#clip0_49_319)" id="Icon">
          <path d={svgPaths.p391f5e80} id="Vector" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
          <path d={svgPaths.p4b4c200} id="Vector_2" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
          <path d={svgPaths.p2fb16300} id="Vector_3" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49988" />
        </g>
        <defs>
          <clipPath id="clip0_49_319">
            <rect fill="white" height="23.9988" width="23.9988" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text18() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[31.162px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[16px] not-italic text-[#3b82f6] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Sales</p>
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[86.97px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon5 />
      <Text18 />
    </div>
  );
}

function Icon6() {
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

function Text19() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[52.226px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[26.5px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Contacts</p>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[224.36px] top-[-0.5px] w-[84.22px]" data-name="Button">
      <Icon6 />
      <Text19 />
    </div>
  );
}

function Icon7() {
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

function Text20() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[29.412px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[15px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">More</p>
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[317.28px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon7 />
      <Text20 />
    </div>
  );
}

function Icon8() {
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

function Button11() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex flex-col items-center justify-center left-[159.66px] pb-[0.008px] pt-0 px-0 rounded-[16847700px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[56px] top-[-6.51px]" data-name="Button">
      <Icon8 />
    </div>
  );
}

function BottomNav() {
  return (
    <div className="absolute bg-[#1f2937] border-black border-solid border-t-[0.502px] h-[67.988px] left-0 top-[784.58px] w-[393.647px]" data-name="BottomNav">
      <Button7 />
      <Button8 />
      <Button9 />
      <Button10 />
      <Button11 />
    </div>
  );
}

export default function MobileErpAppDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Mobile ERP App Design">
      <SalesHome />
      <SalesHome1 />
      <SalesHome2 />
      <BottomNav />
    </div>
  );
}