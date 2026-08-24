import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";
import { world, system, Player } from "@minecraft/server";
import { MapVariant, MapPolicy } from "./types";

const POLICY_KEY = "mapdisabler:policy";
const TITLE = "§8[§bMapDisabler§8]";

const MAP_VARIANTS: MapVariant[] = [
    { key: "map_plain", label: "Map 1 (no locator)", itemId: "minecraft:filled_map", data: 0, locator: false },
    { key: "map_plain_2", label: "Map 2 (no locator)", itemId: "minecraft:filled_map", data: 1, locator: false },
    { key: "map_locator", label: "Locator Map", itemId: "minecraft:filled_map", data: 2, locator: true },
    { key: "map_ocean", label: "Ocean Explorer Map", itemId: "minecraft:filled_map", data: 3, locator: true },
    { key: "map_woodland", label: "Woodland Explorer Map", itemId: "minecraft:filled_map", data: 4, locator: true },
    { key: "map_treasure", label: "Treasure Map", itemId: "minecraft:filled_map", data: 5, locator: true },
    { key: "map_empty", label: "Empty Map", itemId: "minecraft:empty_map", data: 1, locator: false },
    { key: "map_empty_locator", label: "Empty Locator Map", itemId: "minecraft:empty_map", data: 2, locator: true },
];

const DEFAULT_POLICY: MapPolicy = {
    banned: ["map_locator", "map_empty_locator"],
    enforce: true,
    notify: true,
    intervalTicks: 20,
};

const variantByKey = (key: string): MapVariant | undefined => MAP_VARIANTS.find(variant => variant.key === key);

const isAdmin = (player: Player): boolean => player.commandPermissionLevel >= 2;

/**************************************************************/
// Policy management

function getPolicy(): MapPolicy {
    const raw = world.getDynamicProperty(POLICY_KEY);
    if (typeof raw !== "string") return { ...DEFAULT_POLICY };
    try {
        const parsed = JSON.parse(raw) as Partial<MapPolicy>;
        return {
            banned: Array.isArray(parsed.banned) ? parsed.banned : DEFAULT_POLICY.banned,
            enforce: parsed.enforce ?? DEFAULT_POLICY.enforce,
            notify: parsed.notify ?? DEFAULT_POLICY.notify,
            intervalTicks: parsed.intervalTicks ?? DEFAULT_POLICY.intervalTicks,
        };
    } catch {
        return { ...DEFAULT_POLICY };
    };
};

function setPolicy(policy: MapPolicy): void {
    world.setDynamicProperty(POLICY_KEY, JSON.stringify(policy));
    startLoop();
};

function policySummary(policy: MapPolicy): string {
    const lines = MAP_VARIANTS.map((v) => {
        const banned = policy.banned.includes(v.key);
        return `${banned ? "" : ""} ${v.label}`;
    });
    const state = policy.enforce ? "§aON" : "§cOFF";
    return `§7Enforcement: ${state}§7 - every ${policy.intervalTicks} ticks\n\n${lines.join("\n")}`
};

function testforItem(player: Player, itemId: string, data: number, clear: boolean): boolean {
    try {
        if (clear) {
            return player.runCommand(`clear @s ${itemId} ${data}`).successCount > 0;
        } else {
            return player.runCommand(`clear @s ${itemId} ${data} 0`).successCount > 0;
        }
    } catch {
        return false;
    };
};

function enforceOn(player: Player, policy: MapPolicy): void {
    const removed: string[] = [];
    for (const key of policy.banned) {
        const variant = variantByKey(key);
        if (!variant) continue;
        const hadItem = testforItem(player, variant.itemId, variant.data, true);
        if (hadItem) removed.push(variant.label);
    };
    if (removed.length > 0 && policy.notify) {
        player.sendMessage(`${TITLE} §cRemoved banned map(s): ${removed.join(", ")}`);
    };
};

let loopHandle: number | undefined;

function startLoop(): void {
    if (loopHandle !== undefined) system.clearRun(loopHandle);

    const interval = Math.max(10, getPolicy().intervalTicks);
    loopHandle = system.runInterval(() => {
        const policy = getPolicy();
        if (!policy.enforce || policy.banned.length === 0) return;
        for (const player of world.getPlayers()) enforceOn(player, policy);
    }, interval);
};

/**************************************************************/
// UI

/**
 * When the chat is closed the reason will be "user busy", normally causing the first .show() call to fail. 
 * This function forces retry until the screen is free or the timeout is reached
 * 
 * colon 3
 */
async function forceShow<R extends { cancelationReason?: FormCancelationReason }>(
    player: Player,
    form: { show(player: Player): Promise<R> },
    timeoutTicks = 200
): Promise<R | undefined> {
    const start = system.currentTick;
    while (system.currentTick - start < timeoutTicks) {
        const res = await form.show(player);
        if (res.cancelationReason === FormCancelationReason.UserBusy) continue;
        return res;
    };
    return undefined;
};

async function showMainMenu(player: Player): Promise<void> {
    const policy = getPolicy();

    const form = new ActionFormData()
        .title("Map Policy")
        .body(policySummary(policy))
        .button("Edit Rules")
        .button(policy.enforce ? "Disable Enforcement" : "Enable Enforcement")
        .button("Ban All Locator Maps")
        .button("Allow Everything")
        .button("Close")

    const res = await forceShow(player, form);
    if (!res || res.canceled) return;

    switch (res.selection) {
        case 0:
            await showRulesMenu(player);
            break;
        case 1:
            setPolicy({ ...policy, enforce: !policy.enforce });
            player.sendMessage(`${TITLE} §7Enforcement ${policy.enforce ? "§cdisabled" : "§aenabled"}§7.`)
            break;
        case 2:
            setPolicy({ ...policy, banned: MAP_VARIANTS.filter((v) => v.locator).map((v) => v.key) });
            player.sendMessage(`${TITLE} §7All locator maps have been banned.`)
            break;
        case 3:
            setPolicy({ ...policy, banned: [] });
            player.sendMessage(`${TITLE} §7All maps have been allowed.`);
            break;
    };
};

async function showRulesMenu(player: Player): Promise<void> {
    const policy = getPolicy();
    const intervals = [10, 20, 40, 100];
    const form = new ModalFormData();

    for (const variant of MAP_VARIANTS) {
        form.toggle(`Allow §f${variant.label}${variant.locator ? " §8(locator)" : ""}`, { defaultValue: !policy.banned.includes(variant.key) });
    };
    form.toggle("Notify players on removal", { defaultValue: policy.notify, tooltip: "Players will be notified when a banned map is removed from their inventory" });
    form.dropdown(
        "Check interval",
        intervals.map((t) => `${t} ticks`),
        { defaultValueIndex: Math.max(0, intervals.indexOf(policy.intervalTicks)) }
    );

    const res = await forceShow(player, form);
    if (!res || res.canceled || !res.formValues) return;

    const values = res.formValues;
    const banned = MAP_VARIANTS.filter((_, i) => values[i] === false).map((v) => v.key);
    const notify = values[MAP_VARIANTS.length] === true;
    const intervalTicks = intervals[Number(values[MAP_VARIANTS.length + 1] ?? 1)] ?? 20;

    setPolicy({ ...policy, banned, notify, intervalTicks });
    player.sendMessage(
        banned.length === 0
            ? `${TITLE} §aSaved - all map types allowed.`
            : `${TITLE} §aSaved - §7banned ${banned.map((k) => variantByKey(k)?.label ?? k).join(", ")}`
    );
};

/**************************************************************/
// Events

// @ts-ignore
world.beforeEvents.chatSend.subscribe((event) => {
    const player = event.sender;
    if (event.message !== "!maps") return;
    event.cancel = true;
    player.sendMessage(`${TITLE} §7Close chat...`);

    system.run(() => {
        if (!isAdmin(player)) {
            player.sendMessage(`${TITLE} §7Current rules:\n${policySummary(getPolicy())}`);
            return;
        } else {
            showMainMenu(player);
        };
    });
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const policy = getPolicy();
    if (!policy.enforce) return;
    system.runTimeout(() => enforceOn(event.player, policy), 40);
});

system.run(startLoop);