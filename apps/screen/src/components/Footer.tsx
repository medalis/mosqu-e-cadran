import { Logo } from "./Logo";
import type { Labels } from "../labels";

interface Props { flash: string | null; online: boolean; labels: Labels }

export function Footer({ flash, online, labels }: Props) {
  return (
    <footer>
      <span className="tag">{labels.info}</span>
      <div className="marquee">{flash ? <span key={flash}>{flash}</span> : <span style={{ animation: "none", paddingLeft: 0 }}>&nbsp;</span>}</div>
      <div className="powered">
        <i className={`dot${online ? "" : " off"}`} title={online ? labels.online : labels.offline} aria-label={online ? labels.online : labels.offline} />
        <Logo />Nidaa
      </div>
    </footer>
  );
}
