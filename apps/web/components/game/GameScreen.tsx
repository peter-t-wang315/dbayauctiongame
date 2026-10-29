'use client';
// The in-game screen (WS5). Replaces the WS4 GameSlot placeholder. Orchestrates the two-tap bid
// flow (04 section 5) over useRoom(); all rules decisions stay on the server.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRoom } from '../../lib/net/useRoom';
import { BottomSheet } from '../shell/BottomSheet';
import { Bay, type Hint } from './Bay';
import { CollectionStrip } from './Collections';
import { FxController } from '../fx/FxController';
import { toggleSound } from '../fx/SoundHapticsToggles';
import { GiftStep } from '../gift/GiftStep';
import { DesktopRail } from './DesktopRail';
import { Hand } from './Hand';
import { KeyLegend } from './KeyLegend';
import { Podiums } from './Podiums';
import { ItemDetailsBody } from './ItemDetails';
import { MenuPanel, MySets, type MenuTab } from './MenuPanel';
import { RevealScreen } from '../reveal/RevealScreen';
import { StatusStrip } from './StatusStrip';
import { flyCard } from '../../lib/fx/fly';
import { podiumModels } from '../../lib/game-ui/podiums';
import { useDesktop } from '../../lib/game-ui/useDesktop';
import {
  useAnnouncer,
  useBarTotal,
  useOutbid,
  useServerNow,
  useSoldStamps,
} from '../../lib/game-ui/hooks';
import { bayLegality, cardTapReason, lockedReason, rejectionText } from '../../lib/game-ui/legal';
import {
  IDLE,
  bayForKey,
  CARD_KEYS,
  cardForKey,
  reconcile,
  tapCard,
  type Selection,
} from '../../lib/game-ui/selection';
import { isUrgentEntry } from '../../lib/game-ui/announce';
import { itemDetails } from '../../lib/game-ui/itemDetails';
import { cooldownLeft, nextBarTotal, remainingMs } from '../../lib/game-ui/timers';
import {
  bannerFor,
  bayLayout,
  bayViewModels,
  BAY_LETTERS,
  handSlots,
  latestStatus,
  playerById,
  progressOf,
  summarizeCollection,
} from '../../lib/game-ui/viewModel';
import './game.css';

const FLASH_MS = 2600;

export function GameScreen() {
  const room = useRoom();
  return (
    <>
      <FxController view={room.view} />
      <GameScreenInner />
    </>
  );
}

function GameScreenInner() {
  const room = useRoom();
  const view = room.view;
  const [sel, setSel] = useState<Selection>(IDLE);
  const [pending, setPending] = useState<{ card: string; bay: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [nudge, setNudge] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const [tab, setTab] = useState<MenuTab>('players');
  const desktop = useDesktop();
  const [logOpen, setLogOpen] = useState(true);
  const [detailBay, setDetailBay] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const barTotals = useRef(new Map<number, { key: string; total: number }>());

  const timersActive = !!view && view.phase === 'playing';
  const now = useServerNow(room.serverNow, timersActive);
  const stamps = useSoldStamps(view);
  const outbid = useOutbid(view);
  const announcement = useAnnouncer(view);

  // A new snapshot may invalidate the selection (turn ended, card spent, phase change).
  useEffect(() => {
    if (view) setSel((s) => reconcile(s, view));
  }, [view]);

  const showFlash = useCallback((text: string) => {
    setFlash(text);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }, []);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // Classic: close the collections sheet when my turn starts (04 section 12).
  const myTurnClassic = !!view && view.opts.mode === 'classic' && view.canAct;
  useEffect(() => {
    if (myTurnClassic) setSetsOpen(false);
  }, [myTurnClassic]);

  const cooldown = view ? cooldownLeft(view.cooldownUntil, now) : 0;
  const locked = view ? lockedReason(view, cooldown) !== null : true;
  const canSelect = !!view && !locked && view.phase === 'playing';

  const onCard = useCallback(
    (id: string) => {
      if (!view) return;
      // B2: a tap that can't select says why (spent, out on a bay, not my turn, cooling down).
      const why = view.phase === 'playing' ? cardTapReason(view, id, cooldown, pending?.card ?? null) : null;
      if (why) showFlash(why);
      setSel((s) => tapCard(s, id, view.myHand, canSelect));
    },
    [view, canSelect, cooldown, pending, showFlash],
  );

  const onBay = useCallback(
    async (idx: number) => {
      if (!view || pending) return;
      if (!sel.card) {
        // B2: no silent bay taps either.
        if (view.phase !== 'playing') return;
        const why = lockedReason(view, cooldown);
        showFlash(why ?? (view.bays[idx]?.card ? 'Pick a card first, then tap a bay' : 'Empty bay'));
        return;
      }
      const card = view.myHand.find((c) => c.id === sel.card);
      const bay = view.bays[idx];
      if (!card || !bay) return;
      const l = bayLegality(card, bay, view.me);
      if (!l.legal) {
        setNudge(idx);
        setTimeout(() => setNudge(null), 400);
        showFlash(l.reason ? `Can't bid there: ${l.reason}` : "Can't bid there");
        return;
      }
      setPending({ card: card.id, bay: idx });
      const face = card.kind === 'proxy' ? 'Proxy' : `$${card.value}`;
      flyCard(
        document.querySelector(`[data-fx="hand-card"][data-card="${card.id}"]`),
        document.querySelector(`[data-fx="bay"][data-bay="${idx}"]`),
        face,
      );
      const r = await room.send({ t: 'bid', card: card.id, bay: idx });
      setPending(null);
      if (r.ok) {
        setSel(IDLE);
        showFlash(`Bid sent: ${face} on ${BAY_LETTERS[idx] ?? idx + 1}`);
      } else {
        setSel(IDLE);
        setShake(card.id);
        setTimeout(() => setShake(null), 320);
        showFlash(
          r.code === 'OFFLINE' || r.code === 'TIMEOUT'
            ? 'Connection hiccup. Try again.'
            : rejectionText(bay),
        );
      }
    },
    [view, sel.card, pending, cooldown, room, showFlash],
  );

  // Desktop keyboard flow (04 section 6). Never steal keys from inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || !view) return;
      if (e.key === 'Escape') {
        setSel(IDLE);
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        showFlash(toggleSound() ? 'Sound on' : 'Sound off');
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        const el = (document.activeElement as HTMLElement | null)?.closest('[data-bay]');
        const idx = el ? Number(el.getAttribute('data-bay')) : NaN;
        if (view.bays[idx]?.card) setDetailBay(idx);
        return;
      }
      if ((e.key === 'l' || e.key === 'L') && desktop) {
        setLogOpen((o) => !o);
        return;
      }
      if (e.key === '?') {
        setTab('rules');
        setMenuOpen(true);
        return;
      }
      const c = cardForKey(e.key, view.myHand);
      if (c) {
        onCard(c);
        return;
      }
      const b = bayForKey(e.key);
      if (b !== null && b < view.bays.length) void onBay(b);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, desktop, onCard, onBay, showFlash]);

  const frenzy = view?.opts.mode === 'frenzy';
  // Banner timer (hooks must be unconditional).
  const turn = view?.turn;
  const classicRemaining =
    !frenzy && turn?.phase === 'window' ? remainingMs(turn.endsAt, now) : null;
  const soonest = useMemo(() => {
    if (!view || !frenzy) return null;
    const ends = view.bays.filter((b) => b.card && b.endsAt !== undefined).map((b) => b.endsAt!);
    return ends.length ? Math.min(...ends) : null;
  }, [view, frenzy]);
  const frenzyRemaining = soonest === null ? null : Math.max(0, soonest - now);
  const bannerRemaining = frenzy ? frenzyRemaining : classicRemaining;
  const bannerTotal = useBarTotal(
    frenzy ? 'frenzy' : `c:${turn?.player}:${view?.round.n}`,
    bannerRemaining,
    frenzy ? undefined : 1,
  );

  const leave = useCallback(() => room.leave(), [room]);

  if (!view) return null;
  if (view.phase === 'reveal' || view.phase === 'ended') return <RevealScreen view={view} />;

  const me = playerById(view, view.me);
  const bays = bayViewModels(view);
  const layout = bayLayout(bays.length);
  const slots = handSlots(view.myHand).map((s) =>
    pending && pending.card === s.id ? { ...s, onBay: pending.bay } : s,
  );
  const selectedCard = sel.card ? view.myHand.find((c) => c.id === sel.card) : undefined;
  const banner = bannerFor(view, pending !== null);
  const progress = progressOf(view);
  const status = latestStatus(view);
  const going =
    frenzy &&
    view.bays.some(
      (b) =>
        b.card &&
        b.topBid &&
        (remainingMs(b.endsAt, now) ?? 99999) <= 3000 &&
        (remainingMs(b.endsAt, now) ?? 0) > 0,
    );
  const stripText =
    flash ??
    (going
      ? 'Going once... going twice...'
      : (status?.text ?? (frenzy ? 'Frenzy! Bid any time.' : 'Doors open! First bays are up.')));
  const summary = summarizeCollection(me?.collection ?? [], me?.gifts ?? 0);
  const keyHints: Record<string, string> = {};
  for (const k of CARD_KEYS) {
    const id = cardForKey(k, view.myHand);
    if (id) keyHints[id] = k;
  }
  const detail = detailBay !== null ? itemDetails(view, detailBay) : null;
  const gifting = view.stage === 'gifts' && !!view.gift;
  const subtext = frenzy && cooldown > 0 ? 'Cooling down...' : undefined;

  return (
    <div
      className="g-shell"
      data-phase={view.phase}
      data-mode={view.opts.mode}
      data-stage={view.stage}
    >
      {/* Classic: pulse the screen edges in my color while it's my turn. */}
      {banner.mine && view.canAct && view.stage === 'bidding' && (
        <div
          className="g-turnframe"
          aria-hidden="true"
          data-fx="turn-frame"
          style={banner.color ? { ['--accent' as string]: `var(--p-${banner.color})` } : undefined}
        />
      )}
      <div className="g-screen" data-bays={bays.length} data-layout={layout}>
        <StatusStrip
          text={stripText}
          silent={flash === null && !!status && isUrgentEntry(view, status.n)}
          title={banner.title}
          sub={subtext}
          mine={banner.mine}
          color={banner.color}
          remaining={bannerRemaining}
          barTotal={bannerTotal}
          showClock={!frenzy}
          canPass={!frenzy && banner.mine && view.canAct && view.stage === 'bidding'}
          progress={progress}
          showMenu
          onPass={() => void room.send({ t: 'pass' })}
          onOpenLog={() => {
            if (desktop) {
              setLogOpen(true);
              return;
            }
            setTab('log');
            setMenuOpen(true);
          }}
          onOpenMenu={() => {
            setTab('players');
            setMenuOpen(true);
          }}
        />
        {desktop && <Podiums players={podiumModels(view, pending !== null)} />}
        <Hand
          slots={slots}
          selected={sel.card}
          locked={locked}
          shake={shake}
          keyHints={keyHints}
          onTap={onCard}
        />
        <div className="g-bays" data-fx="bays" data-gifting={gifting ? 'true' : undefined}>
          {bays.map((vm) => {
            const raw = view.bays[vm.idx]!;
            const rem = frenzy ? remainingMs(vm.endsAt, now) : null;
            const key = `${vm.idx}:${vm.card?.id ?? '-'}`;
            const tot = nextBarTotal(barTotals.current.get(vm.idx), key, rem);
            barTotals.current.set(vm.idx, tot);
            let hint: Hint = { kind: 'none' };
            if (selectedCard) {
              const l = bayLegality(selectedCard, raw, view.me);
              hint = l.legal
                ? { kind: 'legal' }
                : { kind: 'illegal', reason: l.reason ?? 'Not allowed' };
            }
            const stamp = stamps.find((s) => s.bay === vm.idx);
            return (
              <Bay
                key={vm.idx}
                vm={pending?.bay === vm.idx ? { ...vm, mine: false } : vm}
                layout={layout}
                showTimer={!!frenzy}
                hint={hint}
                armed={!!selectedCard}
                me={me}
                remaining={rem}
                barTotal={tot.total}
                outbid={outbid.has(vm.idx)}
                sold={stamp ? { by: playerById(view, stamp.by), amount: stamp.amount } : null}
                sending={
                  pending?.bay === vm.idx
                    ? selectedCard?.kind === 'proxy'
                      ? 'Proxy'
                      : `$${selectedCard?.value ?? ''}`
                    : null
                }
                nudge={nudge === vm.idx}
                keyHint={['Q', 'W', 'E', 'R'][vm.idx]}
                onTap={() => void onBay(vm.idx)}
                onDetails={() => setDetailBay(vm.idx)}
              />
            );
          })}
        </div>
        {!desktop && <CollectionStrip summary={summary} onOpen={() => setSetsOpen(true)} />}
        {desktop && <KeyLegend bays={bays.length} />}
        <div className="sr-only" aria-live="assertive" aria-atomic="true" data-fx="assertive-live">
          {announcement && <span key={announcement.n}>{announcement.text}</span>}
        </div>
        {gifting && <GiftStep view={view} now={now} send={room.send} />}
      </div>

      {desktop && (
        <aside className="g-side" aria-label="Your sets and event log">
          <DesktopRail
            view={view}
            logOpen={logOpen}
            onToggleLog={() => setLogOpen((o) => !o)}
            onOpenPanel={(t) => {
              setTab(t);
              setMenuOpen(true);
            }}
          />
        </aside>
      )}

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <MenuPanel view={view} tab={tab} onTab={setTab} onLeave={leave} />
      </BottomSheet>
      <BottomSheet open={detail !== null} onClose={() => setDetailBay(null)} title="Item details">
        {detail && <ItemDetailsBody d={detail} onClose={() => setDetailBay(null)} />}
      </BottomSheet>
      <BottomSheet open={setsOpen} onClose={() => setSetsOpen(false)} title="Your collections">
        <MySets view={view} />
        <button type="button" className="btn btn--primary" onClick={() => setSetsOpen(false)}>
          Back to bidding
        </button>
      </BottomSheet>
    </div>
  );
}
