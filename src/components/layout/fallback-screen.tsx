/* The root not-found and error boundaries. The error screen replaces every
   layout below the root; not-found for an unknown URL does too, while a
   notFound() thrown by a page renders inside that page's layout — the public
   chrome (mp.css) or the app shell (globals.css). None of those is
   guaranteed, so this carries its own few rules, scoped by class and inlined
   with the markup. The values mirror the shadcn tokens and Button variants
   the screens used before (primary, outline, ring). The font follows
   whichever surface it landed in: the site's Geist inside the public chrome,
   Inter inside the app, the system stack under the bare root. */

const css = `
body{margin:0}
.ttc-fb{box-sizing:border-box;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:0 24px;background:#fafafa;color:oklch(0.145 0 0);font-family:var(--mp-sans,var(--font-inter,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif));line-height:1.5;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.ttc-fb *,.ttc-fb *::before,.ttc-fb *::after{box-sizing:border-box}
.ttc-fb__box{width:100%;max-width:448px;text-align:center}
.ttc-fb__box>*{margin:0}
.ttc-fb__box>*+*{margin-top:16px}
.ttc-fb__logo{display:block;width:64px;height:64px;object-fit:contain;margin-inline:auto}
.ttc-fb__title{font-size:18px;line-height:28px;font-weight:600;color:oklch(0.21 0.034 264.665)}
.ttc-fb__text{font-size:14px;line-height:20px;color:oklch(0.556 0 0)}
.ttc-fb__ref{font-size:12px;line-height:16px;color:oklch(0.556 0 0 / 0.7)}
.ttc-fb__actions{display:flex;align-items:center;justify-content:center;gap:8px}
.ttc-fb__btn{display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 16px;border:1px solid transparent;border-radius:8px;background:oklch(0.205 0 0);color:oklch(0.985 0 0);font:inherit;font-size:14px;line-height:20px;font-weight:500;white-space:nowrap;text-decoration:none;cursor:pointer;outline:none;transition:background-color .15s cubic-bezier(.4,0,.2,1),box-shadow .15s cubic-bezier(.4,0,.2,1)}
.ttc-fb__btn:hover{background:oklch(0.205 0 0 / 0.9)}
.ttc-fb__btn--outline{border-color:oklch(0.922 0 0);background:#fff;color:oklch(0.145 0 0);box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.05)}
.ttc-fb__btn--outline:hover{background:oklch(0.97 0 0);color:oklch(0.205 0 0)}
.ttc-fb__btn:focus-visible{border-color:oklch(0 0 0);box-shadow:0 0 0 3px oklch(0 0 0 / 0.5)}
`;

export const fallbackButton = "ttc-fb__btn";
export const fallbackButtonOutline = "ttc-fb__btn ttc-fb__btn--outline";

export function FallbackScreen({
  title,
  text,
  reference,
  children,
}: {
  title: string;
  text: React.ReactNode;
  reference?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ttc-fb">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="ttc-fb__box">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ttc/img/logo-square.png"
          alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC."
          width={64}
          height={64}
          className="ttc-fb__logo"
        />
        <h1 className="ttc-fb__title">{title}</h1>
        <p className="ttc-fb__text">{text}</p>
        {/* The digest is the only handle on the server-side stack, so surface
            it for anyone reporting the failure. */}
        {reference && <p className="ttc-fb__ref">Reference: {reference}</p>}
        <div className="ttc-fb__actions">{children}</div>
      </div>
    </div>
  );
}
