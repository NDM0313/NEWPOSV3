import svgPaths from "./svg-411k0tdg1c";

function Heading1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Heading 2">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[14px] text-white top-[0.51px] tracking-[-0.1504px]">Entry Details</p>
    </div>
  );
}

function Label() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#d1d5db] text-[14px] top-[0.51px] tracking-[-0.1504px]">Entry Date *</p>
    </div>
  );
}

function DatePicker() {
  return (
    <div className="bg-[#374151] h-[48.986px] relative rounded-[10px] shrink-0 w-full" data-name="Date Picker">
      <div aria-hidden="true" className="absolute border-[#4b5563] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex flex-col gap-[7.994px] h-[76.986px] items-start relative shrink-0 w-full" data-name="Container">
      <Label />
      <DatePicker />
    </div>
  );
}

function Label1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#d1d5db] text-[14px] top-[0.51px] tracking-[-0.1504px]">Description *</p>
    </div>
  );
}

function TextArea() {
  return (
    <div className="bg-[#374151] h-[120.959px] relative rounded-[10px] shrink-0 w-full" data-name="Text Area">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[16px] py-[12px] relative size-full">
          <p className="css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[#6b7280] text-[16px] tracking-[-0.3125px]">Enter entry description...</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#4b5563] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex flex-col gap-[7.994px] h-[155.377px] items-start relative shrink-0 w-full" data-name="Container">
      <Label1 />
      <TextArea />
    </div>
  );
}

function Label2() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#d1d5db] text-[14px] top-[0.51px] tracking-[-0.1504px]">Reference / Voucher # (Optional)</p>
    </div>
  );
}

function TextInput() {
  return (
    <div className="bg-[#374151] h-[48.986px] relative rounded-[10px] shrink-0 w-full" data-name="Text Input">
      <div className="flex flex-row items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center px-[16px] py-[12px] relative size-full">
          <p className="css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[#6b7280] text-[16px] tracking-[-0.3125px]">e.g., Invoice #123, Receipt #456</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border-[#4b5563] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Container2() {
  return (
    <div className="content-stretch flex flex-col gap-[7.994px] h-[76.986px] items-start relative shrink-0 w-full" data-name="Container">
      <Label2 />
      <TextInput />
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex flex-col gap-[15.997px] h-[341.342px] items-start relative shrink-0 w-full" data-name="Container">
      <Container />
      <Container1 />
      <Container2 />
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-[#1f2937] h-[410.342px] relative rounded-[14px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="content-stretch flex flex-col gap-[15.997px] items-start pb-[0.502px] pt-[16.499px] px-[16.499px] relative size-full">
        <Heading1 />
        <Container3 />
      </div>
    </div>
  );
}

function GeneralEntryFlow() {
  return (
    <div className="absolute bg-[#111827] content-stretch flex flex-col h-[852.567px] items-start left-0 pb-0 pt-[131.974px] px-[15.997px] top-0 w-[393.647px]" data-name="GeneralEntryFlow">
      <Container4 />
    </div>
  );
}

function Icon() {
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

function Button() {
  return (
    <div className="relative rounded-[10px] shrink-0 size-[35.987px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-0 pt-[7.994px] px-[7.994px] relative size-full">
        <Icon />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">General Entry</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.8)] top-[0.5px]">Manual journal entry</p>
    </div>
  );
}

function Container5() {
  return (
    <div className="flex-[1_0_0] h-[39.995px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Heading />
        <Paragraph />
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="content-stretch flex gap-[11.996px] h-[39.995px] items-center relative shrink-0 w-full" data-name="Container">
      <Button />
      <Container5 />
    </div>
  );
}

function Container7() {
  return <div className="bg-white flex-[1_0_0] h-[3.993px] min-h-px min-w-px rounded-[16847700px]" data-name="Container" />;
}

function Container8() {
  return <div className="bg-[rgba(255,255,255,0.3)] flex-[1_0_0] h-[3.993px] min-h-px min-w-px rounded-[16847700px]" data-name="Container" />;
}

function Container9() {
  return (
    <div className="h-[3.993px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[7.994px] items-center pl-0 pr-[0.008px] py-0 relative size-full">
          <Container7 />
          {[...Array(3).keys()].map((_, i) => (
            <Container8 key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.8)] top-[0.5px] w-[61px]">Step 1 of 4</p>
    </div>
  );
}

function GeneralEntryFlow1() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex flex-col from-[#8b5cf6] gap-[15.997px] h-[115.977px] items-start left-0 pb-0 pt-[15.997px] px-[15.997px] to-[#7c3aed] top-0 w-[393.647px]" data-name="GeneralEntryFlow">
      <Container6 />
      <Container9 />
      <Paragraph1 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="absolute left-[210.11px] size-[17.997px] top-[14.99px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.9972 17.9972">
        <g id="Icon">
          <path d="M3.74941 8.99859H14.2478" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49976" />
          <path d={svgPaths.p1a69c140} id="Vector_2" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49976" />
        </g>
      </svg>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-gradient-to-b from-[#8b5cf6] h-[47.982px] opacity-50 relative rounded-[14px] shrink-0 to-[#7c3aed] w-full" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[168.05px] not-italic text-[#f9fafb] text-[16px] text-center top-[11px] tracking-[-0.3125px] translate-x-[-50%]">Continue</p>
      <Icon1 />
    </div>
  );
}

function GeneralEntryFlow2() {
  return (
    <div className="absolute bg-[#1f2937] content-stretch flex flex-col h-[80.477px] items-start left-0 pb-0 pt-[16.499px] px-[15.997px] top-[772.09px] w-[393.647px]" data-name="GeneralEntryFlow">
      <div aria-hidden="true" className="absolute border-[#374151] border-solid border-t-[0.502px] inset-0 pointer-events-none" />
      <Button1 />
    </div>
  );
}

function Icon2() {
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

function Text() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[33.931px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[17px] not-italic text-[#3b82f6] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Home</p>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[12.34px] top-[-0.5px] w-[65.924px]" data-name="Button">
      <Icon2 />
      <Text />
    </div>
  );
}

function Icon3() {
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

function Text1() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[31.162px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[16px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Sales</p>
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[86.97px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon3 />
      <Text1 />
    </div>
  );
}

function Icon4() {
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

function Text2() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[52.226px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[26.5px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Contacts</p>
      </div>
    </div>
  );
}

function Button4() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[224.36px] top-[-0.5px] w-[84.22px]" data-name="Button">
      <Icon4 />
      <Text2 />
    </div>
  );
}

function Icon5() {
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

function Text3() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[29.412px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[15px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">More</p>
      </div>
    </div>
  );
}

function Button5() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[317.28px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon5 />
      <Text3 />
    </div>
  );
}

function Icon6() {
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

function Button6() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex flex-col items-center justify-center left-[159.66px] pb-[0.008px] pt-0 px-0 rounded-[16847700px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[56px] top-[-6.51px]" data-name="Button">
      <Icon6 />
    </div>
  );
}

function BottomNav() {
  return (
    <div className="absolute bg-[#1f2937] border-black border-solid border-t-[0.502px] h-[67.988px] left-0 top-[784.58px] w-[393.647px]" data-name="BottomNav">
      <Button2 />
      <Button3 />
      <Button4 />
      <Button5 />
      <Button6 />
    </div>
  );
}

export default function MobileErpAppDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Mobile ERP App Design">
      <GeneralEntryFlow />
      <GeneralEntryFlow1 />
      <GeneralEntryFlow2 />
      <BottomNav />
    </div>
  );
}