interface CnLogoProps {
  className?: string;
  variant?: "light" | "dark";
}

// Logo oficial CN Cold puxado do site cncold.com.br
const LOGO_URL =
  "https://www.cncold.com.br/wp-content/uploads/2023/05/logo-horizontal-com-setas-777-x-186-300x72.png";

export function CnLogo({ className, variant = "dark" }: CnLogoProps) {
  return (
    <div className={className}>
      <img
        src={LOGO_URL}
        alt="CN Cold"
        className={variant === "dark" ? "h-9 w-auto brightness-0 invert" : "h-9 w-auto"}
      />
    </div>
  );
}
