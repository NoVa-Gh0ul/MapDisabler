export interface MapVariant {
    key: string;
    label: string;
    itemId: string;
    data: number;
    /** Whether this variant renders a live position marker */
    locator: boolean;
};

export interface MapPolicy {
    banned: string[];
    enforce: boolean;
    notify: boolean;
    intervalTicks: number;
};