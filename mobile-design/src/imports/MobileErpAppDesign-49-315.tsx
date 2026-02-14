import svgPaths from "./svg-5a91gvy1dk";

function Heading1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Heading 2">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">AVAILABLE PRODUCTS</p>
    </div>
  );
}

function Heading2() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-full" data-name="Heading 3">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">Wedding Gown - White</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[70px]">Rs. 25,000</p>
    </div>
  );
}

function Container() {
  return (
    <div className="h-[47.99px] relative shrink-0 w-[170.801px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[3.993px] items-start relative size-full">
        <Heading2 />
        <Paragraph />
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[19.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g id="Icon">
          <path d="M4.16619 9.99887H15.8315" id="Vector" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          <path d="M9.99887 4.16619V15.8315" id="Vector_2" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
        </g>
      </svg>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute content-stretch flex h-[47.99px] items-center justify-between left-[16.5px] top-[16.5px] w-[328.656px]" data-name="Container">
      <Container />
      <Icon />
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#1f2937] h-[80.987px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container1 />
    </div>
  );
}

function AddProducts() {
  return (
    <div className="absolute bg-[#111827] content-stretch flex flex-col gap-[11.996px] h-[852.567px] items-start left-0 pb-0 pt-[236.442px] px-[15.997px] top-0 w-[393.647px]" data-name="AddProducts">
      <Heading1 />
      <Button />
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

function Button1() {
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
    <div className="h-[27.992px] relative shrink-0 w-[85.161px]" data-name="Heading 1">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[28px] left-0 not-italic text-[#f9fafb] text-[18px] top-[0.01px] tracking-[-0.4395px]">Add Items</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="h-[35.987px] relative shrink-0 w-[133.143px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[11.996px] items-center relative size-full">
        <Button1 />
        <Heading />
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#374151] h-[39.98px] relative rounded-[10px] shrink-0 w-[66.497px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[33.5px] not-italic text-[#6b7280] text-[16px] text-center top-[7px] tracking-[-0.3125px] translate-x-[-50%]">Next</p>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[39.98px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Container2 />
          <Button2 />
        </div>
      </div>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#9ca3af] text-[12px] top-[0.5px]">Customer</p>
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-0.99px] tracking-[-0.3125px]">Ahmed Retailers</p>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[52px]">Items: 0</p>
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-[#111827] h-[87.985px] relative rounded-[10px] shrink-0 w-full" data-name="Container">
      <div className="content-stretch flex flex-col gap-[3.993px] items-start pb-0 pl-[11.996px] pr-[11.995px] pt-[11.996px] relative size-full">
        <Paragraph1 />
        <Paragraph2 />
        <Paragraph3 />
      </div>
    </div>
  );
}

function TextInput() {
  return (
    <div className="absolute bg-[#111827] h-[43.997px] left-0 rounded-[10px] top-0 w-[361.654px]" data-name="Text Input">
      <div className="content-stretch flex items-center overflow-clip pl-[44px] pr-[16px] py-0 relative rounded-[inherit] size-full">
        <p className="css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-[rgba(249,250,251,0.5)] tracking-[-0.1504px]">h</p>
      </div>
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Icon2() {
  return (
    <div className="absolute left-[12px] size-[19.998px] top-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g id="Icon">
          <path d={svgPaths.p2f131a80} id="Vector" stroke="var(--stroke-0, #6B7280)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          <path d={svgPaths.p314cdc80} id="Vector_2" stroke="var(--stroke-0, #6B7280)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
        </g>
      </svg>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[43.997px] relative shrink-0 w-full" data-name="Container">
      <TextInput />
      <Icon2 />
    </div>
  );
}

function AddProducts1() {
  return (
    <div className="absolute bg-[#1f2937] content-stretch flex flex-col gap-[11.996px] h-[220.446px] items-start left-0 pb-[0.502px] pt-[11.996px] px-[15.997px] top-0 w-[393.647px]" data-name="AddProducts">
      <div aria-hidden="true" className="absolute border-[#374151] border-b-[0.502px] border-solid inset-0 pointer-events-none" />
      <Container3 />
      <Container4 />
      <Container5 />
    </div>
  );
}

function Container6() {
  return <div className="absolute bg-[#374151] h-[3.993px] left-[156.83px] rounded-[16847700px] top-[7.99px] w-[47.998px]" data-name="Container" />;
}

function Heading3() {
  return (
    <div className="absolute h-[27.992px] left-[24px] top-0 w-[313.656px]" data-name="Heading 2">
      <p className="absolute css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[28px] left-0 not-italic text-[#f9fafb] text-[18px] top-[0.01px] tracking-[-0.4395px]">Wedding Gown - White</p>
    </div>
  );
}

function Paragraph4() {
  return (
    <div className="absolute h-[20.006px] left-[24px] top-[27.99px] w-[313.656px]" data-name="Paragraph">
      <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px] w-[70px]">Unit: Piece</p>
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute border-[#374151] border-b-[0.502px] border-solid h-[64.496px] left-0 top-[27.98px] w-[361.654px]" data-name="Container">
      <Heading3 />
      <Paragraph4 />
    </div>
  );
}

function Label() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Variation</p>
    </div>
  );
}

function Button3() {
  return (
    <div className="absolute bg-[#3b82f6] h-[40.984px] left-0 rounded-[10px] top-0 w-[72.656px]" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[36.5px] not-italic text-[16px] text-center text-white top-[7.5px] tracking-[-0.3125px] translate-x-[-50%]">Small</p>
    </div>
  );
}

function Button4() {
  return (
    <div className="absolute bg-[#111827] border-[#374151] border-[0.502px] border-solid h-[40.984px] left-[80.65px] rounded-[10px] top-0 w-[92.575px]" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[46px] not-italic text-[#9ca3af] text-[16px] text-center top-[7px] tracking-[-0.3125px] translate-x-[-50%]">Medium</p>
    </div>
  );
}

function Button5() {
  return (
    <div className="absolute bg-[#111827] border-[#374151] border-[0.502px] border-solid h-[40.984px] left-[181.22px] rounded-[10px] top-0 w-[75.095px]" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[37px] not-italic text-[#9ca3af] text-[16px] text-center top-[7px] tracking-[-0.3125px] translate-x-[-50%]">Large</p>
    </div>
  );
}

function Button6() {
  return (
    <div className="absolute bg-[#111827] border-[#374151] border-[0.502px] border-solid h-[40.984px] left-0 rounded-[10px] top-[48.98px] w-[52.728px]" data-name="Button">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[26px] not-italic text-[#9ca3af] text-[16px] text-center top-[7px] tracking-[-0.3125px] translate-x-[-50%]">XL</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="h-[89.962px] relative shrink-0 w-full" data-name="Container">
      <Button3 />
      <Button4 />
      <Button5 />
      <Button6 />
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex flex-col gap-[11.996px] h-[121.963px] items-start relative shrink-0 w-full" data-name="Container">
      <Label />
      <Container8 />
    </div>
  );
}

function Label1() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Quantity</p>
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[19.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g id="Icon">
          <path d="M4.16619 9.99887H15.8315" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
        </g>
      </svg>
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-[#111827] h-[47.998px] relative rounded-[10px] shrink-0 w-[35.892px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[0.502px] relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function NumberInput() {
  return (
    <div className="bg-[#111827] flex-[1_0_0] h-[47.998px] min-h-px min-w-px relative rounded-[10px]" data-name="Number Input">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center overflow-clip relative rounded-[inherit] size-full">
        <p className="css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[28px] not-italic relative shrink-0 text-[#f9fafb] text-[18px] text-center tracking-[-0.4395px]">1</p>
      </div>
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[19.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9977 19.9977">
        <g id="Icon">
          <path d="M4.16619 9.99887H15.8315" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
          <path d="M9.99887 4.16619V15.8315" id="Vector_2" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66648" />
        </g>
      </svg>
    </div>
  );
}

function Button8() {
  return (
    <div className="bg-[#111827] h-[47.998px] relative rounded-[10px] shrink-0 w-[35.892px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[0.502px] relative size-full">
        <Icon4 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="content-stretch flex gap-[15.997px] h-[47.998px] items-center relative shrink-0 w-full" data-name="Container">
      <Button7 />
      <NumberInput />
      <Button8 />
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex flex-col gap-[11.996px] h-[79.999px] items-start relative shrink-0 w-full" data-name="Container">
      <Label1 />
      <Container10 />
    </div>
  );
}

function Label2() {
  return (
    <div className="h-[20.006px] relative shrink-0 w-full" data-name="Label">
      <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#9ca3af] text-[14px] top-[0.51px] tracking-[-0.1504px]">Price (Editable)</p>
    </div>
  );
}

function NumberInput1() {
  return (
    <div className="absolute bg-[#111827] h-[56px] left-0 rounded-[10px] top-0 w-[313.656px]" data-name="Number Input">
      <div className="content-stretch flex items-center overflow-clip pl-[56px] pr-[16px] py-0 relative rounded-[inherit] size-full">
        <p className="css-ew64yg font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[normal] not-italic relative shrink-0 text-[18px] text-[rgba(249,250,251,0.5)] tracking-[-0.4395px]">25000</p>
      </div>
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.506px] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Text() {
  return (
    <div className="absolute h-[23.991px] left-[16px] top-[16px] w-[22.485px]" data-name="Text">
      <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#9ca3af] text-[16px] top-[-0.99px] tracking-[-0.3125px]">Rs.</p>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[56px] relative shrink-0 w-full" data-name="Container">
      <NumberInput1 />
      <Text />
    </div>
  );
}

function Button9() {
  return (
    <div className="bg-[#111827] flex-[1_0_0] h-[32.997px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-[76.73px] not-italic text-[#f9fafb] text-[12px] text-center top-[9px] translate-x-[-50%] w-[100px]">Retail: Rs. 25,000</p>
      </div>
    </div>
  );
}

function Button10() {
  return (
    <div className="bg-[#111827] flex-[1_0_0] h-[32.997px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-[76.72px] not-italic text-[#f9fafb] text-[12px] text-center top-[9px] translate-x-[-50%] w-[127px]">Wholesale: Rs. 20,000</p>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex gap-[7.994px] h-[32.997px] items-start pl-0 pr-[-0.008px] py-0 relative shrink-0 w-full" data-name="Container">
      <Button9 />
      <Button10 />
    </div>
  );
}

function Container14() {
  return (
    <div className="content-stretch flex flex-col gap-[11.996px] h-[132.994px] items-start relative shrink-0 w-full" data-name="Container">
      <Label2 />
      <Container12 />
      <Container13 />
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[23.991px] relative shrink-0 w-[71.126px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#9ca3af] text-[16px] top-[-0.99px] tracking-[-0.3125px]">Item Total</p>
      </div>
    </div>
  );
}

function Text2() {
  return (
    <div className="h-[31.993px] relative shrink-0 w-[158.727px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-4hzbpn font-['Inter:Bold',sans-serif] font-bold leading-[32px] left-0 not-italic text-[#10b981] text-[24px] top-[-0.49px] tracking-[0.0703px] w-[159px]">Rs. 25,000.00</p>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="content-stretch flex h-[31.993px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Text1 />
      <Text2 />
    </div>
  );
}

function Button11() {
  return (
    <div className="flex-[1_0_0] h-[47.998px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.502px] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[75.18px] not-italic text-[#f9fafb] text-[16px] text-center top-[11.01px] tracking-[-0.3125px] translate-x-[-50%]">Cancel</p>
      </div>
    </div>
  );
}

function Button12() {
  return (
    <div className="bg-[#3b82f6] flex-[1_0_0] h-[47.998px] min-h-px min-w-px relative rounded-[10px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-[74.76px] not-italic text-[#f9fafb] text-[16px] text-center top-[11.01px] tracking-[-0.3125px] translate-x-[-50%]">Add to Cart</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex gap-[11.995px] h-[47.998px] items-start pl-0 pr-[-0.008px] py-0 relative shrink-0 w-full" data-name="Container">
      <Button11 />
      <Button12 />
    </div>
  );
}

function Container17() {
  return (
    <div className="content-stretch flex flex-col gap-[23.999px] h-[120.489px] items-start pb-0 pt-[16.499px] px-0 relative shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#374151] border-solid border-t-[0.502px] inset-0 pointer-events-none" />
      <Container15 />
      <Container16 />
    </div>
  );
}

function Container18() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[23.999px] h-[575.439px] items-start left-0 pb-0 pt-[23.999px] px-[23.999px] top-[92.48px] w-[361.654px]" data-name="Container">
      <Container9 />
      <Container11 />
      <Container14 />
      <Container17 />
    </div>
  );
}

function Container19() {
  return (
    <div className="bg-[#1f2937] h-[667.92px] relative rounded-tl-[24px] rounded-tr-[24px] shrink-0 w-[361.654px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <Container6 />
        <Container7 />
        <Container18 />
      </div>
    </div>
  );
}

function ProductDialog() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.6)] content-stretch flex h-[852.567px] items-end justify-center left-0 pb-[15.997px] pt-0 px-0 top-0 w-[393.647px]" data-name="ProductDialog">
      <Container19 />
    </div>
  );
}

function Icon5() {
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

function Text3() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[33.931px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[17px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Home</p>
      </div>
    </div>
  );
}

function Button13() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[12.34px] top-[-0.5px] w-[65.924px]" data-name="Button">
      <Icon5 />
      <Text3 />
    </div>
  );
}

function Icon6() {
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

function Text4() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[31.162px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[16px] not-italic text-[#3b82f6] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Sales</p>
      </div>
    </div>
  );
}

function Button14() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[86.97px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon6 />
      <Text4 />
    </div>
  );
}

function Icon7() {
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

function Text5() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[52.226px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[26.5px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">Contacts</p>
      </div>
    </div>
  );
}

function Button15() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[224.36px] top-[-0.5px] w-[84.22px]" data-name="Button">
      <Icon7 />
      <Text5 />
    </div>
  );
}

function Icon8() {
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

function Text6() {
  return (
    <div className="h-[16.004px] relative shrink-0 w-[29.412px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute css-ew64yg font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[15px] not-italic text-[#9ca3af] text-[12px] text-center top-[0.5px] translate-x-[-50%]">More</p>
      </div>
    </div>
  );
}

function Button16() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.993px] h-[67.988px] items-center justify-center left-[317.28px] top-[-0.5px] w-[63.994px]" data-name="Button">
      <Icon8 />
      <Text6 />
    </div>
  );
}

function Icon9() {
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

function Button17() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex flex-col items-center justify-center left-[159.66px] pb-[0.008px] pt-0 px-0 rounded-[16847700px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1),0px_4px_6px_-4px_rgba(0,0,0,0.1)] size-[56px] top-[-6.51px]" data-name="Button">
      <Icon9 />
    </div>
  );
}

function BottomNav() {
  return (
    <div className="absolute bg-[#1f2937] border-black border-solid border-t-[0.502px] h-[67.988px] left-0 top-[784.58px] w-[393.647px]" data-name="BottomNav">
      <Button13 />
      <Button14 />
      <Button15 />
      <Button16 />
      <Button17 />
    </div>
  );
}

export default function MobileErpAppDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Mobile ERP App Design">
      <AddProducts />
      <AddProducts1 />
      <ProductDialog />
      <BottomNav />
    </div>
  );
}