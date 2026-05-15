import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import "./index.scss";

interface IProps {
    selected?: boolean;
    onClick?: () => void;
    onContextMenu?: (...args: any) => void;
    iconName?: SvgAssetIconNames;
    title?: string;
    /** Secondary line, e.g. track count (shown smaller under the title). */
    subtitle?: string;
}

export default function ListItem(props: IProps) {
    const { selected, onClick, iconName, title, subtitle, onContextMenu } =
        props ?? {};
    const tip =
        title && subtitle
            ? `${title} · ${subtitle}`
            : title ?? subtitle ?? undefined;
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={tip}
            role="button"
            className="side-bar--list-item-container"
            data-selected={selected}
        >
            {iconName ? <SvgAsset iconName={iconName}></SvgAsset> : null}
            <div className="side-bar--list-item-label">
                <span className="side-bar--list-item-title">{title ?? ""}</span>
                {subtitle ? (
                    <span className="side-bar--list-item-subtitle">
                        {subtitle}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
