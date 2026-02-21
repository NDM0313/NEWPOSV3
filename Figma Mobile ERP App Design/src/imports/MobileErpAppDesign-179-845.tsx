import svgPaths from "./svg-pkffl13wh9";

function Heading1() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Heading 2">
      <p className="flex-[1_0_0] font-['Arial:Bold',sans-serif] leading-[20px] min-h-px min-w-px not-italic relative text-[14px] text-white whitespace-pre-wrap">Select Debit Account</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Which account should be debited?</p>
    </div>
  );
}

function Container() {
  return (
    <div className="bg-[#1f2937] h-[77.462px] relative rounded-[14px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#374151] border-[0.749px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="content-stretch flex flex-col gap-[7.996px] items-start pb-[0.749px] pt-[16.74px] px-[16.74px] relative size-full">
        <Heading1 />
        <Paragraph />
      </div>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[106.038px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Bold',sans-serif] leading-[20px] min-h-px min-w-px not-italic relative text-[14px] text-white whitespace-pre-wrap">Cash Account</p>
    </div>
  );
}

function Paragraph2() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[106.038px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Asset</p>
    </div>
  );
}

function Paragraph3() {
  return (
    <div className="absolute h-[15.991px] left-0 top-[39.98px] w-[106.038px]" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 450,000</p>
    </div>
  );
}

function Container3() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[106.038px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph1 />
        <Paragraph2 />
        <Paragraph3 />
      </div>
    </div>
  );
}

function Icon() {
  return (
    <div className="relative shrink-0 size-[19.995px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.9947 19.9947">
        <g id="Icon">
          <path d={svgPaths.p31fab300} id="Vector" stroke="var(--stroke-0, #EF4444)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66623" />
        </g>
      </svg>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container3 />
      <Icon />
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[rgba(239,68,68,0.2)] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#ef4444] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container2 />
    </div>
  );
}

function Paragraph4() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Bank Account - HBL</p>
    </div>
  );
}

function Paragraph5() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Asset</p>
    </div>
  );
}

function Paragraph6() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 850,000</p>
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[126.337px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph4 />
        <Paragraph5 />
        <Paragraph6 />
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] pr-[229.26px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container5 />
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#1f2937] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container4 />
    </div>
  );
}

function Paragraph7() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[130.832px]" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Bank Account - MCB</p>
    </div>
  );
}

function Paragraph8() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[130.832px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Asset</p>
    </div>
  );
}

function Paragraph9() {
  return (
    <div className="absolute h-[15.991px] left-0 top-[39.98px] w-[130.832px]" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 400,000</p>
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[130.832px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph7 />
        <Paragraph8 />
        <Paragraph9 />
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] pr-[224.765px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container7 />
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#1f2937] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container6 />
    </div>
  );
}

function Paragraph10() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[129.345px]" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Accounts Receivable</p>
    </div>
  );
}

function Paragraph11() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[129.345px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Asset</p>
    </div>
  );
}

function Paragraph12() {
  return (
    <div className="absolute h-[15.991px] left-0 top-[39.98px] w-[129.345px]" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 250,000</p>
    </div>
  );
}

function Container9() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[129.345px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph10 />
        <Paragraph11 />
        <Paragraph12 />
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] pr-[226.252px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container9 />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#1f2937] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container8 />
    </div>
  );
}

function Paragraph13() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Bold',sans-serif] leading-[20px] min-h-px min-w-px not-italic relative text-[14px] text-white whitespace-pre-wrap">Inventory</p>
    </div>
  );
}

function Paragraph14() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Asset</p>
    </div>
  );
}

function Paragraph15() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 500,000</p>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[106.038px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph13 />
        <Paragraph14 />
        <Paragraph15 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] pr-[249.559px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container11 />
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[#1f2937] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container10 />
    </div>
  );
}

function Paragraph16() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Accounts Payable</p>
    </div>
  );
}

function Paragraph17() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Liability</p>
    </div>
  );
}

function Paragraph18() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[#6b7280] text-[12px] top-[-1px] w-[107px] whitespace-pre-wrap">Balance: Rs. 180,000</p>
    </div>
  );
}

function Container13() {
  return (
    <div className="h-[55.969px] relative shrink-0 w-[111.212px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph16 />
        <Paragraph17 />
        <Paragraph18 />
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="absolute content-stretch flex h-[55.969px] items-center justify-between left-[17.49px] pr-[244.385px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container13 />
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#1f2937] h-[90.948px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container12 />
    </div>
  );
}

function Paragraph19() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[84.615px]" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Rent Expense</p>
    </div>
  );
}

function Paragraph20() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[84.615px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Expense</p>
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[84.615px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph19 />
        <Paragraph20 />
      </div>
    </div>
  );
}

function Container14() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[270.982px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container15 />
    </div>
  );
}

function Button6() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container14 />
    </div>
  );
}

function Paragraph21() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Salary Expense</p>
    </div>
  );
}

function Paragraph22() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Expense</p>
    </div>
  );
}

function Container17() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[94.354px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph21 />
        <Paragraph22 />
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[261.242px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container17 />
    </div>
  );
}

function Button7() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container16 />
    </div>
  );
}

function Paragraph23() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[93.652px]" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Utility Expense</p>
    </div>
  );
}

function Paragraph24() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[93.652px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Expense</p>
    </div>
  );
}

function Container19() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[93.652px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph23 />
        <Paragraph24 />
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[261.945px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container19 />
    </div>
  );
}

function Button8() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container18 />
    </div>
  );
}

function Paragraph25() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Sales Revenue</p>
    </div>
  );
}

function Paragraph26() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Revenue</p>
    </div>
  );
}

function Container21() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[89.871px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph25 />
        <Paragraph26 />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[265.726px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container21 />
    </div>
  );
}

function Button9() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container20 />
    </div>
  );
}

function Paragraph27() {
  return (
    <div className="absolute content-stretch flex h-[19.995px] items-start left-0 top-0 w-[103.392px]" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Service Revenue</p>
    </div>
  );
}

function Paragraph28() {
  return (
    <div className="absolute content-stretch flex h-[15.991px] items-start left-0 top-[19.99px] w-[103.392px]" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Revenue</p>
    </div>
  );
}

function Container23() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[103.392px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Paragraph27 />
        <Paragraph28 />
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[252.205px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container23 />
    </div>
  );
}

function Button10() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container22 />
    </div>
  );
}

function Paragraph29() {
  return (
    <div className="content-stretch flex h-[19.995px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="font-['Arial:Bold',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-white">Owner Equity</p>
    </div>
  );
}

function Paragraph30() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[#9ca3af] text-[12px] whitespace-pre-wrap">Equity</p>
    </div>
  );
}

function Container25() {
  return (
    <div className="h-[35.986px] relative shrink-0 w-[85.469px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Paragraph29 />
        <Paragraph30 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="absolute content-stretch flex h-[35.986px] items-center justify-between left-[17.49px] pr-[270.128px] top-[17.49px] w-[355.597px]" data-name="Container">
      <Container25 />
    </div>
  );
}

function Button11() {
  return (
    <div className="bg-[#1f2937] h-[70.965px] relative rounded-[14px] shrink-0 w-full" data-name="Button">
      <div aria-hidden="true" className="absolute border-[#374151] border-[1.498px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container24 />
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex flex-col gap-[7.996px] h-[1059.427px] items-start relative shrink-0 w-full" data-name="Container">
      <Button />
      <Button1 />
      <Button2 />
      <Button3 />
      <Button4 />
      <Button5 />
      <Button6 />
      <Button7 />
      <Button8 />
      <Button9 />
      <Button10 />
      <Button11 />
    </div>
  );
}

function GeneralEntryFlow() {
  return (
    <div className="absolute bg-[#111827] content-stretch flex flex-col gap-[15.991px] h-[1460.796px] items-start left-0 pt-[131.932px] px-[15.991px] top-0 w-[422.558px]" data-name="GeneralEntryFlow">
      <Container />
      <Container1 />
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[19.995px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute bottom-[20.83%] left-[20.83%] right-1/2 top-[20.83%]" data-name="Vector">
        <div className="absolute inset-[-7.14%_-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 7.49802 13.3298">
            <path d={svgPaths.pcc96040} id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66623" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/2 left-[20.83%] right-[20.83%] top-1/2" data-name="Vector">
        <div className="absolute inset-[-0.83px_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.3298 1.66623">
            <path d="M12.4967 0.833113H0.833113" id="Vector" stroke="var(--stroke-0, #F9FAFB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66623" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button12() {
  return (
    <div className="relative rounded-[10px] shrink-0 size-[35.986px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[7.996px] px-[7.996px] relative size-full">
        <Icon1 />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[23.998px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute font-['Arial:Bold',sans-serif] leading-[24px] left-0 not-italic text-[#f9fafb] text-[16px] top-[-1.5px]">General Entry</p>
    </div>
  );
}

function Paragraph31() {
  return (
    <div className="content-stretch flex h-[15.991px] items-start relative shrink-0 w-full" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Arial:Regular',sans-serif] leading-[16px] min-h-px min-w-px not-italic relative text-[12px] text-[rgba(255,255,255,0.8)] whitespace-pre-wrap">Manual journal entry</p>
    </div>
  );
}

function Container27() {
  return (
    <div className="flex-[1_0_0] h-[39.989px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Heading />
        <Paragraph31 />
      </div>
    </div>
  );
}

function Container26() {
  return (
    <div className="content-stretch flex gap-[11.999px] h-[39.989px] items-center relative shrink-0 w-full" data-name="Container">
      <Button12 />
      <Container27 />
    </div>
  );
}

function Container29() {
  return <div className="bg-white flex-[1_0_0] h-[3.992px] min-h-px min-w-px rounded-[25139500px]" data-name="Container" />;
}

function Container30() {
  return <div className="bg-[rgba(255,255,255,0.3)] flex-[1_0_0] h-[3.992px] min-h-px min-w-px rounded-[25139500px]" data-name="Container" />;
}

function Container31() {
  return <div className="bg-[rgba(255,255,255,0.3)] flex-[1_0_0] h-[3.992px] min-h-px min-w-px rounded-[25139500px]" data-name="Container" />;
}

function Container28() {
  return (
    <div className="content-stretch flex gap-[7.996px] h-[3.992px] items-center relative shrink-0 w-full" data-name="Container">
      <Container29 />
      <Container30 />
      <Container31 />
    </div>
  );
}

function Paragraph32() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[16px] left-0 not-italic text-[12px] text-[rgba(255,255,255,0.8)] top-[-1px] w-[57px] whitespace-pre-wrap">Step 1 of 3</p>
    </div>
  );
}

function GeneralEntryFlow1() {
  return (
    <div className="absolute bg-gradient-to-b content-stretch flex flex-col from-[#8b5cf6] gap-[15.991px] h-[115.941px] items-start left-0 pt-[15.991px] px-[15.991px] to-[#7c3aed] top-0 w-[422.558px]" data-name="GeneralEntryFlow">
      <Container26 />
      <Container28 />
      <Paragraph32 />
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[23.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9983 23.9983">
        <g id="Icon">
          <path d={svgPaths.p2d3978e0} id="Vector" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49983" />
          <path d={svgPaths.p392c5400} id="Vector_2" stroke="var(--stroke-0, #3B82F6)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49983" />
        </g>
      </svg>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-[32.989px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[#3b82f6] text-[12px] text-center">Home</p>
      </div>
    </div>
  );
}

function Button13() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.992px] h-[67.98px] items-center justify-center left-[15.82px] top-[-0.75px] w-[64.971px]" data-name="Button">
      <Icon2 />
      <Text />
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[23.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9983 23.9983">
        <g clipPath="url(#clip0_179_862)" id="Icon">
          <path d={svgPaths.p38802900} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p27d456f2} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p1b32fc00} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
        </g>
        <defs>
          <clipPath id="clip0_179_862">
            <rect fill="white" height="23.9983" width="23.9983" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-[27.475px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[#9ca3af] text-[12px] text-center">Sales</p>
      </div>
    </div>
  );
}

function Button14() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.992px] h-[67.98px] items-center justify-center left-[96.44px] top-[-0.75px] w-[63.999px]" data-name="Button">
      <Icon3 />
      <Text1 />
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[23.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9983 23.9983">
        <g id="Icon">
          <path d={svgPaths.p28eca100} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p213bfb40} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p28f71c80} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p111c0680} id="Vector_4" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
        </g>
      </svg>
    </div>
  );
}

function Text2() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-[47.365px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[#9ca3af] text-[12px] text-center">Contacts</p>
      </div>
    </div>
  );
}

function Button15() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.992px] h-[67.98px] items-center justify-center left-[247.73px] top-[-0.75px] w-[79.347px]" data-name="Button">
      <Icon4 />
      <Text2 />
    </div>
  );
}

function Icon5() {
  return (
    <div className="relative shrink-0 size-[23.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9983 23.9983">
        <g id="Icon">
          <path d={svgPaths.p15b73800} id="Vector" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p1df4bc40} id="Vector_2" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
          <path d={svgPaths.p4312df0} id="Vector_3" stroke="var(--stroke-0, #9CA3AF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.99986" />
        </g>
      </svg>
    </div>
  );
}

function Text3() {
  return (
    <div className="h-[15.991px] relative shrink-0 w-[28.962px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Arial:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[#9ca3af] text-[12px] text-center">More</p>
      </div>
    </div>
  );
}

function Button16() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[3.992px] h-[67.98px] items-center justify-center left-[342.73px] top-[-0.75px] w-[63.999px]" data-name="Button">
      <Icon5 />
      <Text3 />
    </div>
  );
}

function Icon6() {
  return (
    <div className="relative shrink-0 size-[23.998px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 23.9983 23.9983">
        <g clipPath="url(#clip0_179_853)" id="Icon">
          <path d={svgPaths.p5f77f00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49983" />
          <path d={svgPaths.p3f139000} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49983" />
          <path d={svgPaths.p2fed3600} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.49983" />
        </g>
        <defs>
          <clipPath id="clip0_179_853">
            <rect fill="white" height="23.9983" width="23.9983" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button17() {
  return (
    <div className="absolute bg-[#3b82f6] content-stretch flex flex-col items-center justify-center left-[176.09px] pb-[0.012px] rounded-[25139500px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] size-[55.992px] top-[-6.75px]" data-name="Button">
      <Icon6 />
    </div>
  );
}

function BottomNav() {
  return (
    <div className="absolute bg-[#1f2937] border-black border-solid border-t-[0.749px] h-[67.98px] left-0 top-[888.77px] w-[422.558px]" data-name="BottomNav">
      <Button13 />
      <Button14 />
      <Button15 />
      <Button16 />
      <Button17 />
    </div>
  );
}

function Icon7() {
  return (
    <div className="absolute left-[207.57px] size-[17.993px] top-[16.99px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.9929 17.9929">
        <g id="Icon">
          <path d="M3.74852 8.99645H14.2444" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49941" />
          <path d={svgPaths.p13b37180} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.49941" />
        </g>
      </svg>
    </div>
  );
}

function Button18() {
  return (
    <div className="bg-gradient-to-b from-[#8b5cf6] h-[51.977px] relative rounded-[14px] shrink-0 to-[#7c3aed] w-full" data-name="Button">
      <p className="-translate-x-1/2 absolute font-['Arial:Bold',sans-serif] leading-[24px] left-[182.5px] not-italic text-[16px] text-center text-white top-[12.49px]">Next</p>
      <Icon7 />
    </div>
  );
}

function GeneralEntryFlow2() {
  return (
    <div className="absolute bg-[#1f2937] content-stretch flex flex-col h-[84.708px] items-start left-0 pt-[16.74px] px-[15.991px] top-[872.04px] w-[422.558px]" data-name="GeneralEntryFlow">
      <div aria-hidden="true" className="absolute border-[#374151] border-solid border-t-[0.749px] inset-0 pointer-events-none" />
      <Button18 />
    </div>
  );
}

export default function MobileErpAppDesign() {
  return (
    <div className="bg-white relative size-full" data-name="Mobile ERP App Design">
      <GeneralEntryFlow />
      <GeneralEntryFlow1 />
      <BottomNav />
      <GeneralEntryFlow2 />
    </div>
  );
}