import svgPaths from "./svg-mprl40kyy7";

function H() {
  return (
    <div className="h-[36px] relative shrink-0 w-full" data-name="h1">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[36px] left-0 not-italic text-[30px] text-white top-[-2px]">Permission Management</p>
    </div>
  );
}

function P() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="p">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#90a1b9] text-[16px] top-[-1.67px]">Role-based module and action permissions (owner/admin only)</p>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[68px] relative shrink-0 w-[447.094px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[8px] items-start relative size-full">
        <H />
        <P />
      </div>
    </div>
  );
}

function Save() {
  return (
    <div className="absolute left-[24px] size-[20px] top-[14px]" data-name="Save">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="Save">
          <path d={svgPaths.p38f8300} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.pf973700} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p14392758} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Button() {
  return (
    <div className="bg-[#096] h-[48px] relative rounded-[10px] shadow-[0px_10px_15px_0px_rgba(0,153,102,0.3),0px_4px_6px_0px_rgba(0,153,102,0.3)] shrink-0 w-[109.563px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Save />
        <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[69px] not-italic text-[16px] text-center text-white top-[10.33px]">Save</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute content-stretch flex h-[68px] items-center justify-between left-[32px] top-[32px] w-[1114px]" data-name="Container">
      <Container1 />
      <Button />
    </div>
  );
}

function H2() {
  return (
    <div className="absolute h-[27px] left-[24px] top-[24px] w-[1064.667px]" data-name="h3">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[27px] left-0 not-italic text-[18px] text-white top-[-0.67px]">Role</p>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#314158] h-[40px] relative rounded-[10px] shrink-0 w-[95.958px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[48px] not-italic text-[#cad5e2] text-[16px] text-center top-[6.33px]">Owner</p>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#314158] h-[40px] relative rounded-[10px] shrink-0 w-[96.073px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[48px] not-italic text-[#cad5e2] text-[16px] text-center top-[6.33px]">Admin</p>
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#096] h-[40px] relative rounded-[10px] shadow-[0px_10px_15px_0px_rgba(0,153,102,0.3),0px_4px_6px_0px_rgba(0,153,102,0.3)] shrink-0 w-[112.896px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[56.5px] not-italic text-[16px] text-center text-white top-[6.33px]">Manager</p>
      </div>
    </div>
  );
}

function Button4() {
  return (
    <div className="bg-[#314158] h-[40px] relative rounded-[10px] shrink-0 w-[155.688px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-[78px] not-italic text-[#cad5e2] text-[16px] text-center top-[6.33px]">User/Salesman</p>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="absolute content-stretch flex gap-[12px] h-[40px] items-start left-[24px] top-[67px] w-[1064.667px]" data-name="Container">
      <Button1 />
      <Button2 />
      <Button3 />
      <Button4 />
    </div>
  );
}

function P1() {
  return (
    <div className="absolute h-[20px] left-[24px] top-[119px] w-[1064.667px]" data-name="p">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#90a1b9] text-[14px] top-[-0.33px]">Owners and Admins have full system regardless of toggles. Changes apply to Managers and Users.</p>
    </div>
  );
}

function Container2() {
  return (
    <div className="absolute bg-[#020618] border-[#314158] border-[0.667px] border-solid h-[164.333px] left-[32px] rounded-[14px] top-[132px] w-[1114px]" data-name="Container">
      <H2 />
      <Container3 />
      <P1 />
    </div>
  );
}

function H3() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="h3">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[27px] left-0 not-italic text-[18px] text-white top-[-0.67px]">Sales Visibility</p>
    </div>
  );
}

function Input() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span() {
  return (
    <div className="h-[24px] relative shrink-0 w-[69.135px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Own only</p>
      </div>
    </div>
  );
}

function Label() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input />
      <Span />
    </div>
  );
}

function Input1() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[50.115px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Branch</p>
      </div>
    </div>
  );
}

function Label1() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input1 />
      <Span1 />
    </div>
  );
}

function Input2() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span2() {
  return (
    <div className="h-[24px] relative shrink-0 w-[68.938px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Company</p>
      </div>
    </div>
  );
}

function Label2() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input2 />
      <Span2 />
    </div>
  );
}

function Container6() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[12px] h-[96px] items-start left-0 top-0 w-[524.333px]" data-name="Container">
      <Label />
      <Label1 />
      <Label2 />
    </div>
  );
}

function Input3() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span3() {
  return (
    <div className="h-[24px] relative shrink-0 w-[46.76px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Create</p>
      </div>
    </div>
  );
}

function Label3() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input3 />
      <Span3 />
    </div>
  );
}

function Input4() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span4() {
  return (
    <div className="h-[24px] relative shrink-0 w-[27.885px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Edit</p>
      </div>
    </div>
  );
}

function Label4() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input4 />
      <Span4 />
    </div>
  );
}

function Input5() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span5() {
  return (
    <div className="h-[24px] relative shrink-0 w-[46.844px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Delete</p>
      </div>
    </div>
  );
}

function Label5() {
  return (
    <div className="content-stretch flex gap-[12px] h-[24px] items-center relative shrink-0 w-full" data-name="label">
      <Input5 />
      <Span5 />
    </div>
  );
}

function Container7() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[12px] h-[96px] items-start left-[540.33px] top-0 w-[524.333px]" data-name="Container">
      <Label3 />
      <Label4 />
      <Label5 />
    </div>
  );
}

function Container5() {
  return (
    <div className="h-[96px] relative shrink-0 w-full" data-name="Container">
      <Container6 />
      <Container7 />
    </div>
  );
}

function Container4() {
  return (
    <div className="absolute bg-[#020618] content-stretch flex flex-col gap-[16px] h-[188.333px] items-start left-[32px] pb-[0.667px] pt-[24.667px] px-[24.667px] rounded-[14px] top-[320.33px] w-[1114px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <H3 />
      <Container5 />
    </div>
  );
}

function H4() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="h3">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[27px] left-0 not-italic text-[18px] text-white top-[-0.67px]">Payment Permissions</p>
    </div>
  );
}

function Input6() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span6() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Can receive</p>
      </div>
    </div>
  );
}

function Label6() {
  return (
    <div className="h-[24px] relative shrink-0 w-[111px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input6 />
        <Span6 />
      </div>
    </div>
  );
}

function Input7() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span7() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Can edit</p>
      </div>
    </div>
  );
}

function Label7() {
  return (
    <div className="h-[24px] relative shrink-0 w-[88.125px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input7 />
        <Span7 />
      </div>
    </div>
  );
}

function Input8() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span8() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Can delete</p>
      </div>
    </div>
  );
}

function Label8() {
  return (
    <div className="h-[24px] relative shrink-0 w-[105.031px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input8 />
        <Span8 />
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex gap-[24px] h-[24px] items-start relative shrink-0 w-full" data-name="Container">
      <Label6 />
      <Label7 />
      <Label8 />
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute bg-[#020618] content-stretch flex flex-col gap-[16px] h-[116.333px] items-start left-[32px] pb-[0.667px] pt-[24.667px] px-[24.667px] rounded-[14px] top-[532.67px] w-[1114px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <H4 />
      <Container9 />
    </div>
  );
}

function H5() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="h3">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[27px] left-0 not-italic text-[18px] text-white top-[-0.67px]">Ledger Permissions</p>
    </div>
  );
}

function Input9() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span9() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">View customer ledger</p>
      </div>
    </div>
  );
}

function Label9() {
  return (
    <div className="h-[24px] relative shrink-0 w-[185.823px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input9 />
        <Span9 />
      </div>
    </div>
  );
}

function Input10() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span10() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">View supplier ledger</p>
      </div>
    </div>
  );
}

function Label10() {
  return (
    <div className="h-[24px] relative shrink-0 w-[176.531px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input10 />
        <Span10 />
      </div>
    </div>
  );
}

function Input11() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span11() {
  return (
    <div className="h-[24px] relative shrink-0 w-[147.625px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">View full accounting</p>
      </div>
    </div>
  );
}

function Label11() {
  return (
    <div className="h-[24px] relative shrink-0 w-[175.625px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Input11 />
        <Span11 />
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex gap-[24px] h-[24px] items-start relative shrink-0 w-full" data-name="Container">
      <Label9 />
      <Label10 />
      <Label11 />
    </div>
  );
}

function Container10() {
  return (
    <div className="absolute bg-[#020618] content-stretch flex flex-col gap-[16px] h-[116.333px] items-start left-[32px] pb-[0.667px] pt-[24.667px] px-[24.667px] rounded-[14px] top-[673px] w-[1114px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <H5 />
      <Container11 />
    </div>
  );
}

function H6() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="h3">
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[27px] left-0 not-italic text-[18px] text-white top-[-0.67px]">Other Modules</p>
    </div>
  );
}

function Span12() {
  return (
    <div className="h-[24px] relative shrink-0 w-[69.771px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Inventory</p>
      </div>
    </div>
  );
}

function Input12() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span13() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">view</p>
      </div>
    </div>
  );
}

function Label12() {
  return (
    <div className="h-[20px] relative shrink-0 w-[52.792px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input12 />
        <Span13 />
      </div>
    </div>
  );
}

function Input13() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span14() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">adjust</p>
      </div>
    </div>
  );
}

function Label13() {
  return (
    <div className="h-[20px] relative shrink-0 w-[62.667px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input13 />
        <Span14 />
      </div>
    </div>
  );
}

function Input14() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span15() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">transfer</p>
      </div>
    </div>
  );
}

function Label14() {
  return (
    <div className="h-[20px] relative shrink-0 w-[73.208px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input14 />
        <Span15 />
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[20px] relative shrink-0 w-[236.667px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-start relative size-full">
        <Label12 />
        <Label13 />
        <Label14 />
      </div>
    </div>
  );
}

function Container14() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Span12 />
          <Container15 />
        </div>
      </div>
    </div>
  );
}

function Span16() {
  return (
    <div className="h-[24px] relative shrink-0 w-[63.167px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Contacts</p>
      </div>
    </div>
  );
}

function Input15() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span17() {
  return (
    <div className="h-[20px] relative shrink-0 w-[28.792px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">view</p>
      </div>
    </div>
  );
}

function Label15() {
  return (
    <div className="h-[20px] relative shrink-0 w-[52.792px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input15 />
        <Span17 />
      </div>
    </div>
  );
}

function Input16() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span18() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">edit</p>
      </div>
    </div>
  );
}

function Label16() {
  return (
    <div className="h-[20px] relative shrink-0 w-[48.594px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input16 />
        <Span18 />
      </div>
    </div>
  );
}

function Container17() {
  return (
    <div className="h-[20px] relative shrink-0 w-[125.385px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-start relative size-full">
        <Label15 />
        <Label16 />
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Span16 />
          <Container17 />
        </div>
      </div>
    </div>
  );
}

function Span19() {
  return (
    <div className="h-[24px] relative shrink-0 w-[39.573px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Users</p>
      </div>
    </div>
  );
}

function Input17() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span20() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">create</p>
      </div>
    </div>
  );
}

function Label17() {
  return (
    <div className="h-[20px] relative shrink-0 w-[62.802px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input17 />
        <Span20 />
      </div>
    </div>
  );
}

function Input18() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span21() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">edit</p>
      </div>
    </div>
  );
}

function Label18() {
  return (
    <div className="h-[20px] relative shrink-0 w-[48.594px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input18 />
        <Span21 />
      </div>
    </div>
  );
}

function Input19() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span22() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">delete</p>
      </div>
    </div>
  );
}

function Label19() {
  return (
    <div className="h-[20px] relative shrink-0 w-[63.385px]" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input19 />
        <Span22 />
      </div>
    </div>
  );
}

function Input20() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span23() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">assign permissions</p>
      </div>
    </div>
  );
}

function Label20() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input20 />
        <Span23 />
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="h-[20px] relative shrink-0 w-[389.688px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[24px] items-start relative size-full">
        <Label17 />
        <Label18 />
        <Label19 />
        <Label20 />
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Span19 />
          <Container19 />
        </div>
      </div>
    </div>
  );
}

function Span24() {
  return (
    <div className="h-[24px] relative shrink-0 w-[56.302px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Reports</p>
      </div>
    </div>
  );
}

function Input21() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span25() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">view</p>
      </div>
    </div>
  );
}

function Label21() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input21 />
        <Span25 />
      </div>
    </div>
  );
}

function Container21() {
  return (
    <div className="h-[20px] relative shrink-0 w-[52.792px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <Label21 />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Span24 />
          <Container21 />
        </div>
      </div>
    </div>
  );
}

function Span26() {
  return (
    <div className="h-[24px] relative shrink-0 w-[58.833px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[24px] left-0 not-italic text-[#e2e8f0] text-[16px] top-[-1.67px]">Settings</p>
      </div>
    </div>
  );
}

function Input22() {
  return <div className="shrink-0 size-[16px]" data-name="input" />;
}

function Span27() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#cad5e2] text-[14px] top-[-0.33px]">modify</p>
      </div>
    </div>
  );
}

function Label22() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="label">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Input22 />
        <Span27 />
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="h-[20px] relative shrink-0 w-[69.052px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <Label22 />
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between relative size-full">
          <Span26 />
          <Container23 />
        </div>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex flex-col gap-[16px] h-[184px] items-start relative shrink-0 w-full" data-name="Container">
      <Container14 />
      <Container16 />
      <Container18 />
      <Container20 />
      <Container22 />
    </div>
  );
}

function Container12() {
  return (
    <div className="absolute bg-[#020618] content-stretch flex flex-col gap-[16px] h-[276.333px] items-start left-[32px] pb-[0.667px] pt-[24.667px] px-[24.667px] rounded-[14px] top-[813.33px] w-[1114px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#314158] border-[0.667px] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <H6 />
      <Container13 />
    </div>
  );
}

function MainContent() {
  return (
    <div className="h-[1121.667px] relative shrink-0 w-[1178px]" data-name="Main Content">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Container />
        <Container2 />
        <Container4 />
        <Container8 />
        <Container10 />
        <Container12 />
      </div>
    </div>
  );
}

function Div() {
  return (
    <div className="bg-[#0f172b] h-[1284.333px] relative shrink-0 w-full" data-name="div">
      <div className="content-stretch flex flex-col items-start pl-[24px] pt-[138.667px] relative size-full">
        <MainContent />
      </div>
    </div>
  );
}

function Body() {
  return (
    <div className="absolute bg-[#0a0a0a] content-stretch flex flex-col h-[931.333px] items-start left-0 top-0 w-[1226px]" data-name="Body">
      <Div />
    </div>
  );
}

function Shield() {
  return (
    <div className="relative shrink-0 size-[28px]" data-name="Shield">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 28 28">
        <g id="Shield">
          <path d={svgPaths.p1b228440} id="Vector" stroke="var(--stroke-0, #00D492)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.33333" />
        </g>
      </svg>
    </div>
  );
}

function H1() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="h1">
      <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[28px] left-0 not-italic text-[18px] text-white top-[-1px]">ERP Permission Architecture</p>
    </div>
  );
}

function P2() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#90a1b9] text-[12px] whitespace-pre-wrap">Standard System v1.0</p>
    </div>
  );
}

function Container26() {
  return (
    <div className="flex-[1_0_0] h-[44px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <H1 />
        <P2 />
      </div>
    </div>
  );
}

function Container25() {
  return (
    <div className="h-[44px] relative shrink-0 w-[278.625px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Shield />
        <Container26 />
      </div>
    </div>
  );
}

function Sun() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="Sun">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_2_765)" id="Sun">
          <path d={svgPaths.p20d10600} id="Vector" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 1.66667V3.33333" id="Vector_2" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M10 16.6667V18.3333" id="Vector_3" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p2561cd80} id="Vector_4" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p1a2cf7c0} id="Vector_5" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M1.66667 10H3.33333" id="Vector_6" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M16.6667 10H18.3333" id="Vector_7" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p3d0afd40} id="Vector_8" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p18688e80} id="Vector_9" stroke="var(--stroke-0, #CAD5E2)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_2_765">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="bg-[#0f172b] relative rounded-[10px] shrink-0 size-[40px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Sun />
      </div>
    </div>
  );
}

function User() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="User">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="User">
          <path d={svgPaths.p2026e800} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p32ab0300} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Container28() {
  return (
    <div className="bg-[#096] flex-[1_0_0] h-[40px] min-h-px min-w-px relative rounded-[22369600px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <User />
      </div>
    </div>
  );
}

function Container27() {
  return (
    <div className="h-[40px] relative shrink-0 w-[92px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center relative size-full">
        <Button5 />
        <Container28 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="h-[72px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center justify-between px-[24px] relative size-full">
          <Container25 />
          <Container27 />
        </div>
      </div>
    </div>
  );
}

function Span28() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[59.125px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">Dashboard</p>
      </div>
    </div>
  );
}

function Link() {
  return (
    <div className="h-[16px] relative shrink-0 w-[59.125px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span28 />
      </div>
    </div>
  );
}

function Span29() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[29px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">Roles</p>
      </div>
    </div>
  );
}

function Link1() {
  return (
    <div className="h-[16px] relative shrink-0 w-[29px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span29 />
      </div>
    </div>
  );
}

function Span30() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[35.281px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">Matrix</p>
      </div>
    </div>
  );
}

function Link2() {
  return (
    <div className="h-[16px] relative shrink-0 w-[35.281px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span30 />
      </div>
    </div>
  );
}

function Span31() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[29.688px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">Users</p>
      </div>
    </div>
  );
}

function Link3() {
  return (
    <div className="h-[16px] relative shrink-0 w-[29.688px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span31 />
      </div>
    </div>
  );
}

function Span32() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[37.583px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">Branch</p>
      </div>
    </div>
  );
}

function Link4() {
  return (
    <div className="h-[16px] relative shrink-0 w-[37.583px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span32 />
      </div>
    </div>
  );
}

function Span33() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[19.875px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[#90a1b9] text-[12px]">RLS</p>
      </div>
    </div>
  );
}

function Link5() {
  return (
    <div className="h-[16px] relative shrink-0 w-[19.875px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-center relative size-full">
        <Span33 />
      </div>
    </div>
  );
}

function Span34() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[44.125px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Inter:Medium',sans-serif] font-medium leading-[16px] not-italic relative shrink-0 text-[12px] text-white">Settings</p>
      </div>
    </div>
  );
}

function Div2() {
  return <div className="bg-[#00d492] h-[2px] rounded-[22369600px] shrink-0 w-[24px]" data-name="div" />;
}

function Link6() {
  return (
    <div className="h-[26px] relative shrink-0 w-[44.125px]" data-name="Link">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[8px] items-center relative size-full">
        <Span34 />
        <Div2 />
      </div>
    </div>
  );
}

function Container30() {
  return (
    <div className="h-[26px] relative shrink-0 w-[446.677px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[32px] items-center relative size-full">
        <Link />
        <Link1 />
        <Link2 />
        <Link3 />
        <Link4 />
        <Link5 />
        <Link6 />
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="h-[42px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex items-center justify-center pr-[0.01px] relative size-full">
          <Container30 />
        </div>
      </div>
    </div>
  );
}

function Div1() {
  return (
    <div className="absolute bg-[#020618] content-stretch flex flex-col h-[114.667px] items-start left-0 pb-[0.667px] top-0 w-[1226px]" data-name="div">
      <div aria-hidden="true" className="absolute border-[#1d293d] border-b-[0.667px] border-solid inset-0 pointer-events-none" />
      <Container24 />
      <Container29 />
    </div>
  );
}

export default function CreateErpPermissionArchitecture() {
  return (
    <div className="bg-white relative size-full" data-name="Create ERP Permission Architecture">
      <Body />
      <Div1 />
    </div>
  );
}