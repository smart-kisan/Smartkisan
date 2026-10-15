import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowRight, Banknote, BookOpen, Camera, Check, ChevronRight, CircleHelp, Clock3,
  CloudOff, Download, FileText, Filter, IndianRupee, Leaf, LoaderCircle, LogOut, MapPin, Menu,
  Mic, Plus, Search, Send, ShieldCheck, Sprout, Tractor, Trash2, TrendingUp, UserRound, Volume2,
  Wifi, X,
} from 'lucide-react';
import {
  getGetLedgerEntriesQueryKey, getGetListingsQueryKey, getGetMyOrdersQueryKey,
  getGetMyProfileQueryKey, getGetOrderContactQueryKey, getGetListingBidsQueryKey,
  useAcceptBid, useAskFarmAssistant, useCreateMandiTaxRule, useCreateMspPrice,
  useCreateBid, useCreateLedgerEntry, useCreateListing, useDeleteLedgerEntry,
  useDiagnoseCropImage, useGetGovernmentOverview, useGetLedgerEntries, useGetListings,
  useGetMandiTaxRules,
  useGetListingBids, useGetMyOrders, useGetMyProfile, useGetMspPrices, useGetOrderContact,
  useParseVoiceListing, useSaveMyProfile,
} from '@workspace/api-client-react';
import type { LedgerEntry, Listing, ListingInput, Order } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { MarketplaceRealtime } from '@/lib/realtime';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 0, gcTime: 0, refetchOnWindowFocus: true, retry: 1 } } });
type PublicBuildEnv = {
  BASE_URL?: string;
  VITE_CLERK_PUBLISHABLE_KEY?: string;
  VITE_CLERK_PROXY_URL?: string;
};
const viteEnv = (import.meta as ImportMeta & { env?: PublicBuildEnv }).env;
const nextBasePath =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_BASE_PATH : undefined;
const nextClerkPublishableKey =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    : undefined;
const nextClerkProxyUrl =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CLERK_PROXY_URL : undefined;
const basePath = (viteEnv?.BASE_URL ?? nextBasePath ?? '/').replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  viteEnv?.VITE_CLERK_PUBLISHABLE_KEY ?? nextClerkPublishableKey,
);
const clerkProxyUrl = viteEnv?.VITE_CLERK_PROXY_URL ?? nextClerkProxyUrl;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing the public Clerk publishable key in the application environment');

const appearance = {
  theme: shadcn, cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/icon-192.png` },
  variables: { colorPrimary: '#285d48', colorForeground: '#263c32', colorMutedForeground: '#687b70', colorDanger: '#b74b41', colorBackground: '#fffdf7', colorInput: '#f8f5eb', colorInputForeground: '#263c32', colorNeutral: '#d8d2c2', fontFamily: 'DM Sans, Hind, sans-serif', borderRadius: '0.8rem' },
  elements: {
    rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#263c32] font-bold', headerSubtitle: 'text-[#687b70]', socialButtonsBlockButtonText: 'text-[#263c32]',
    formFieldLabel: 'text-[#31483c]', footerActionLink: 'text-[#285d48] font-semibold', footerActionText: 'text-[#687b70]',
    dividerText: 'text-[#687b70]', identityPreviewEditButton: 'text-[#285d48]', formFieldSuccessText: 'text-[#285d48]',
    alertText: 'text-[#853e37]', logoBox: 'mb-3', logoImage: 'rounded-md', socialButtonsBlockButton: 'border-[#ded8c8] bg-[#fbf9f1]',
    formButtonPrimary: 'bg-[#285d48] hover:bg-[#1e4b39]', formFieldInput: 'border-[#d8d2c2] bg-[#f8f5eb] text-[#263c32]',
    footerAction: 'border-t border-[#e7e1d3]', dividerLine: 'bg-[#ded8c8]', alert: 'border-[#e5c0b9] bg-[#fff5f2]',
    otpCodeFieldInput: 'border-[#d8d2c2] bg-[#f8f5eb]', formFieldRow: 'mb-4', main: 'gap-5',
  },
};

const nav = [
  { href: '/dashboard', label: 'Overview', hi: 'मुख्य पृष्ठ', icon: Activity },
  { href: '/marketplace', label: 'Marketplace', hi: 'मंडी', icon: Search },
  { href: '/farmer', label: 'My listings', hi: 'मेरी फसल', icon: Sprout },
  { href: '/orders', label: 'Deals', hi: 'सौदे', icon: FileText },
  { href: '/government', label: 'MSP & mandi', hi: 'सरकारी भाव', icon: ShieldCheck },
  { href: '/ledger', label: 'KhetKhata', hi: 'खेतखाता', icon: BookOpen },
  { href: '/crop-doctor', label: 'Crop doctor', hi: 'फसल सलाह', icon: Leaf },
];
const money = (v?: number | null) => v == null ? '—' : `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)}`;
const shortDate = (v: string) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Button({ children, onClick, variant = 'primary', type = 'button', disabled = false, className = '' }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'soft' | 'outline' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  const styles = { primary: 'bg-primary text-primary-foreground hover:brightness-95', soft: 'bg-secondary text-secondary-foreground hover:bg-accent/70', outline: 'border border-border bg-card hover:bg-muted', danger: 'bg-destructive text-destructive-foreground' };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid="button-action" className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}
function Field({ label, value, onChange, type = 'text', placeholder = '', required = false, min, max, step, name }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; min?: string; max?: string; step?: string; name?: string }) {
  return <label className="block space-y-1.5 text-sm font-medium text-foreground">{label}<input data-testid={name || `input-${label.toLowerCase().replace(/\s+/g, '-')}`} value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder} required={required} min={min} max={max} step={step} className="h-11 w-full rounded-xl border border-input bg-card px-3.5 outline-none transition focus:ring-2 focus:ring-ring/25" /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return <label className="block space-y-1.5 text-sm font-medium">{label}<select value={value} onChange={e => onChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3.5 outline-none focus:ring-2 focus:ring-ring/25">{options.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>;
}
function Card({ children, className = '' }: { children: ReactNode; className?: string }) { return <section className={`rounded-2xl border border-border bg-card p-5 shadow-[0_5px_18px_rgba(58,69,48,0.035)] ${className}`}>{children}</section>; }
function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 text-xs font-bold uppercase tracking-[.17em] text-primary">{eyebrow}</div><h1 className="font-hindi text-3xl font-semibold tracking-tight sm:text-[2.4rem]">{title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p></div>{action}</div>;
}
function LoadingRows() { return <div className="space-y-3" aria-label="Loading"><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /><div className="h-16 animate-pulse rounded-xl bg-muted" /></div>; }
function QueryError({ retry }: { retry: () => void }) { return <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm"><p className="font-semibold">We couldn’t load this just now.</p><p className="mt-1 text-muted-foreground">Check your connection and try again.</p><Button variant="outline" className="mt-3 min-h-9" onClick={retry}>Try again</Button></div>; }
function Empty({ title, message, action }: { title: string; message: string; action?: ReactNode }) { return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-5 text-center"><div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-primary"><Sprout size={21} /></div><div className="font-semibold">{title}</div><p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>{action && <div className="mt-4">{action}</div>}</div>; }

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function InstallOffline({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  useEffect(() => {
    const capture = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPromptEvent); };
    const on = () => setOnline(true), off = () => setOnline(false);
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
      setPrompt(null);
    } else {
      setShowInstallHelp((visible) => !visible);
    }
  };
  return <div className="relative flex items-center gap-2 text-[11px] font-medium" data-testid="status-connectivity">
    {!compact && <><span className={online ? 'text-muted-foreground' : 'text-destructive'}>{online ? <Wifi size={14} /> : <CloudOff size={14} />}</span><span className={online ? 'text-muted-foreground' : 'text-destructive'}>{online ? 'Connected · data stays online' : 'Offline · reconnect to load data'}</span></>}
    {!installed && <button onClick={install} className="ml-1 inline-flex min-h-9 items-center gap-1 rounded-full bg-secondary px-3 text-foreground" data-testid="button-install"><Download size={13} />{prompt ? 'Install app' : 'Add to Home Screen'}</button>}
    {showInstallHelp && !installed && <div role="dialog" aria-label="Install Smart Kisan" className="absolute right-0 top-11 z-40 w-72 rounded-xl border border-border bg-card p-4 text-left text-xs leading-5 text-foreground shadow-xl"><div className="font-semibold">Add Smart Kisan to your home screen</div><p className="mt-2 text-muted-foreground">Open your browser menu and choose “Install app” or “Add to Home Screen”. On iPhone or iPad, tap Share, then “Add to Home Screen”.</p><button className="mt-3 font-semibold text-primary" onClick={() => setShowInstallHelp(false)}>Close</button></div>}
  </div>;
}
function Brand({ inverse = false }: { inverse?: boolean }) { return <div className={`flex items-center gap-3 ${inverse ? 'text-sidebar-foreground' : 'text-foreground'}`}><img src={`${basePath}/icon-192.png`} alt="Smart Kisan Bharat emblem" className="h-10 w-10 rounded-xl object-cover" /><div><div className="font-hindi text-lg font-bold leading-5">स्मार्ट किसान</div><div className={`text-[10px] font-semibold uppercase tracking-[.18em] ${inverse ? 'text-sidebar-foreground/60' : 'text-muted-foreground'}`}>Smart Kisan</div></div></div>; }

function Home() {
  return <main className="min-h-[100dvh] overflow-hidden bg-background">
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-5 md:px-10"><Brand /><div className="flex items-center gap-1 sm:gap-2"><InstallOffline compact/><Link href="/sign-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-muted sm:px-4">Sign in</Link><Link href="/sign-up" className="rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground sm:px-4">Get started <ArrowRight size={15} className="ml-1 inline" /></Link></div></header>
    <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 md:grid-cols-[1.03fr_.97fr] md:px-10 md:pb-24 md:pt-20">
      <div className="relative z-10"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Built for Haryana’s growers</div><h1 className="font-hindi max-w-2xl text-5xl font-semibold leading-[1.12] tracking-[-.04em] sm:text-6xl lg:text-[4.5rem]">Your harvest.<br /><span className="text-primary">Your fair price.</span></h1><p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">Sell directly to buyers, compare live offers and keep every farm expense in one dependable place.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Join Smart Kisan <ArrowRight size={16} /></Link><Link href="/marketplace" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 font-semibold">Explore marketplace <ChevronRight size={16} /></Link></div><div className="mt-10 flex items-center gap-4 border-t border-border pt-5 text-sm text-muted-foreground"><ShieldCheck size={19} className="text-primary" /> Protected deals. Contact shared only after a deal is locked.</div></div>
      <div className="relative mx-auto w-full max-w-[550px]"><div className="absolute -right-8 -top-8 h-52 w-52 rounded-full bg-accent/20 blur-3xl" /><div className="relative overflow-hidden rounded-[2rem] border border-[#d9d2bd] bg-[#e5e8cd] p-5 shadow-[0_35px_80px_rgba(53,69,48,.16)] sm:p-7"><div className="absolute inset-0 opacity-40" style={{backgroundImage:'radial-gradient(#7c8a5d 1px, transparent 1px)',backgroundSize:'18px 18px'}}/><div className="relative rounded-[1.5rem] border border-[#d4d3bc] bg-[#f9f8ec]/95 p-5 sm:p-7"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">A better harvest starts here</div><div className="mt-1 font-hindi text-2xl font-semibold">आपकी फसल, आपका हक़</div></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e6ead5] text-primary"><Sprout /></span></div><div className="mt-7 rounded-2xl bg-[#e7eddc] p-5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-primary"><ShieldCheck size={15}/> Trade on your terms</div><p className="mt-3 font-hindi text-2xl font-semibold">पहले भरोसा। फिर सौदा।</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Review every offer before you accept. Personal contact stays private until your deal is locked.</p></div><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-[#f3ead1] p-4"><Sprout size={18} className="text-primary"/><div className="mt-3 text-sm font-semibold">Voice listing</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Share crop details in Hindi.</div></div><div className="rounded-2xl border border-[#dedbc8] bg-[#fffdf7] p-4"><BookOpen size={18} className="text-primary"/><div className="mt-3 text-sm font-semibold">KhetKhata</div><div className="mt-1 text-xs leading-5 text-muted-foreground">Your private farm account.</div></div></div></div><div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:flex"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary"><ShieldCheck size={18}/></span><div><div className="text-sm font-semibold">Deal stays private</div><div className="text-xs text-muted-foreground">Until you accept an offer</div></div></div></div></div>
    </section>
    <section className="border-y border-border bg-[#ebeedd] py-14"><div className="mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[.65fr_1.35fr] md:px-10"><div><div className="text-xs font-bold uppercase tracking-[.17em] text-primary">A simpler way to trade</div><h2 className="mt-3 font-hindi text-3xl font-semibold">From field to fair deal.</h2></div><div className="grid gap-6 sm:grid-cols-3"><div><span className="font-mono-data text-sm text-primary">01</span><h3 className="mt-3 font-semibold">List your harvest</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Add produce by voice in Hindi or enter details yourself.</p></div><div><span className="font-mono-data text-sm text-primary">02</span><h3 className="mt-3 font-semibold">Compare offers</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">See buyer bids clearly, without giving away your number.</p></div><div><span className="font-mono-data text-sm text-primary">03</span><h3 className="mt-3 font-semibold">Lock your deal</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Accept an offer to share contact details and move ahead.</p></div></div></div></section>
    <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-2 md:px-10 md:py-24"><div><div className="text-xs font-bold uppercase tracking-[.17em] text-primary">Made for the workday</div><h2 className="mt-3 font-hindi text-4xl font-semibold leading-tight">Tools that respect<br/>your time and your crop.</h2><p className="mt-4 max-w-md text-muted-foreground leading-7">A clear marketplace, a private farm ledger and useful advice—together in one place, built to work comfortably on your phone.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><MapPin size={21}/><h3 className="mt-5 font-semibold">Nearby buyers</h3><p className="mt-2 text-sm text-primary-foreground/75">Browse listings by district and distance.</p></div><div className="rounded-2xl bg-[#f0e5c8] p-5"><IndianRupee size={21} className="text-primary"/><h3 className="mt-5 font-semibold">MSP at a glance</h3><p className="mt-2 text-sm text-muted-foreground">Check current government mandi records.</p></div><div className="rounded-2xl bg-[#e5ebdd] p-5"><BookOpen size={21} className="text-primary"/><h3 className="mt-5 font-semibold">KhetKhata</h3><p className="mt-2 text-sm text-muted-foreground">Keep private notes on farm expenses.</p></div><div className="rounded-2xl bg-[#f1e2db] p-5"><Camera size={21} className="text-[#9c5947]"/><h3 className="mt-5 font-semibold">Crop doctor</h3><p className="mt-2 text-sm text-muted-foreground">Ask questions or submit a crop photo.</p></div></div></section>
    <section className="bg-sidebar px-5 py-14 text-sidebar-foreground md:px-10"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><div className="font-hindi text-3xl font-semibold">खेती आपकी, फ़ैसला आपका।</div><p className="mt-2 text-sm text-sidebar-foreground/65">Create an account to list a harvest or browse live offers.</p></div><Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-sidebar-primary px-5 font-semibold text-sidebar-primary-foreground">Get started <ArrowRight size={16}/></Link></div></section>
    <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-10"><Brand/><span>Smart Kisan Bharat - Modern Agri Ecosystem (By Smart Star Solutions)</span></footer>
  </main>;
}

function SignInPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="fixed left-6 top-6"><Link href="/" aria-label="Smart Kisan home"><Brand/></Link></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>; }
function SignUpPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10"><div className="fixed left-6 top-6"><Link href="/" aria-label="Smart Kisan home"><Brand/></Link></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>; }
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>; }
function Guard({ children }: { children: ReactNode }) { return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>; }

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  const previousUser = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUser.current !== undefined && previousUser.current !== userId) cache.clear();
    previousUser.current = userId;
  }), [addListener, cache]);
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const profileQuery = useGetMyProfile();
  const profile = profileQuery.data?.profile;
  return <div className="min-h-[100dvh] bg-background text-foreground md:grid md:grid-cols-[250px_minmax(0,1fr)]">
    <aside className="hidden min-h-[100dvh] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-[100dvh]"><Link href="/dashboard" className="mb-9 px-2"><Brand inverse/></Link><div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/45">Farm workspace</div><nav className="space-y-1">{nav.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} data-testid={`link-nav-${item.href.slice(1)}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${location === item.href ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><Icon size={17}/><span className="flex-1">{item.label}</span><span className="font-hindi text-xs opacity-60">{item.hi}</span>{location === item.href && <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary"/>}</Link>; })}</nav><div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4"><div className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={15} className="text-sidebar-primary"/> Your deal, your choice</div><p className="mt-2 text-xs leading-5 text-sidebar-foreground/60">Buyer contact is shared only after a deal is locked.</p></div><div className="mt-4 flex items-center gap-3 rounded-xl px-2 py-2"><div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-primary font-semibold text-sidebar-primary-foreground">{(profile?.displayName || user?.firstName || 'SK').slice(0,1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{profile?.displayName || user?.firstName || 'Your account'}</div><div className="truncate text-xs text-sidebar-foreground/55">{profile?.district || 'Set your farm details'}</div></div><button aria-label="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="rounded-lg p-2 hover:bg-sidebar-accent"><LogOut size={16}/></button></div></aside>
    <div className="min-w-0"><header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/95 px-4 backdrop-blur-md sm:px-7"><button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 md:hidden" aria-label="Open navigation"><Menu size={21}/></button><div className="hidden md:block"><div className="text-xs text-muted-foreground">Your farm workspace</div><div className="font-hindi text-sm font-semibold">खेती का हर हिसाब, अब आपके हाथ</div></div><div className="ml-auto flex items-center gap-4"><InstallOffline/><Link href="/profile" className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-sm font-semibold"><span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary"><UserRound size={16}/></span><span className="hidden sm:block">Profile</span></Link></div></header>{mobileOpen && <div className="fixed inset-0 z-50 bg-sidebar p-5 text-sidebar-foreground md:hidden"><div className="mb-8 flex items-center justify-between"><Brand inverse/><button onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X/></button></div><nav className="space-y-1">{nav.map(n => { const Icon=n.icon; return <Link key={n.href} href={n.href} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-3.5 hover:bg-sidebar-accent"><Icon size={18}/>{n.label}<span className="ml-auto font-hindi text-xs opacity-60">{n.hi}</span></Link>; })}<Link href="/profile" onClick={() => setMobileOpen(false)} className="flex gap-3 px-3 py-4"><UserRound/>My profile</Link></nav></div>}<main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">{children}</main><footer className="border-t border-border px-5 py-4 text-center text-[11px] text-muted-foreground">Smart Kisan · Your farm data is private and is never stored offline.</footer></div>
  </div>;
}
function Authed({ children }: { children: ReactNode }) { return <Guard><Shell>{children}</Shell></Guard>; }

function Dashboard() {
  const q = useGetGovernmentOverview();
  const overview = q.data;
  const metrics = overview ? [
    ['Active listings', overview.listingCount, 'Across the marketplace', Sprout],
    ['Open offers', overview.activeBidCount, 'Buyers currently bidding', TrendingUp],
    ['Settled value', money(overview.settledValue), 'Recorded completed deals', Banknote],
    ['MSP alerts', overview.mspAlertCount, 'Listings below MSP', ShieldCheck],
  ] as const : [];
  return <><PageHeading eyebrow="Farm workspace / किसान का काम" title="Good morning." subtitle="Your harvest, offers and farm records—all in one clear view." action={<Link href="/farmer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus size={16}/> Add a listing</Link>}/>{q.isLoading ? <LoadingRows/> : q.isError ? <QueryError retry={() => q.refetch()}/> : overview ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, note, Icon]) => <Card key={label} className="relative overflow-hidden"><div className="flex items-start justify-between"><div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-3 font-mono-data text-2xl font-bold tracking-tight">{value}</div><div className="mt-1.5 text-xs text-muted-foreground">{note}</div></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon size={19}/></span></div></Card>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><Card><div className="flex items-start justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Your next steps</div><h2 className="mt-2 font-hindi text-xl font-semibold">Keep the season moving</h2></div><Activity className="text-primary" size={20}/></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{title:'List a harvest',text:'Tell buyers what is ready.',href:'/farmer',icon:Sprout},{title:'Check local produce',text:'See crop and nursery listings.',href:'/marketplace',icon:Search},{title:'Note a farm cost',text:'Keep your KhetKhata current.',href:'/ledger',icon:BookOpen}].map(({title,text,href,icon:Icon})=><Link key={href} href={href} className="rounded-xl border border-border p-4 transition hover:border-primary/40 hover:bg-secondary/40"><Icon size={18} className="text-primary"/><div className="mt-3 text-sm font-semibold">{title}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{text}</div><ArrowRight size={15} className="mt-3 text-primary"/></Link>)}</div></Card><Card className="bg-[#edf0df]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-primary"><ShieldCheck size={15}/> Fair trade, clearly</div><h2 className="mt-3 font-hindi text-xl font-semibold">You stay in control of the deal.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Compare bids before accepting. Your counterpart’s contact details remain private until both sides have a locked deal.</p><Link href="/orders" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">View your deals <ArrowRight size={15}/></Link></Card></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card><div className="flex justify-between"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Marketplace</div><h2 className="mt-1 font-hindi text-xl font-semibold">Growing together</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{overview.farmerCount.toLocaleString('en-IN')} growers</span></div><div className="mt-5 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-secondary px-3 py-2">{overview.buyerCount.toLocaleString('en-IN')} buyers</span><span className="rounded-full bg-secondary px-3 py-2">{overview.listingCount.toLocaleString('en-IN')} listings</span></div></Card><Card><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Transparent records</div><h2 className="mt-1 font-hindi text-xl font-semibold">Trade and tax overview</h2><div className="mt-4 flex justify-between border-t border-border pt-4 text-sm"><span className="text-muted-foreground">Tax tracked</span><strong>{money(overview.taxTracked)}</strong></div><Link href="/government" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Government records <ArrowRight size={15}/></Link></Card></div></> : <Empty title="Your workspace is ready" message="Live marketplace and government aggregates will appear when your farm data is available." action={<Link href="/marketplace" className="text-sm font-semibold text-primary">Explore marketplace</Link>}/>}</>;
}

function ListingCard({ listing, owner = false, onBid }: { listing: Listing; owner?: boolean; onBid?: (l: Listing) => void }) {
  const [bidding, setBidding] = useState(false);
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState(String(listing.quantity));
  const bids = useGetListingBids(listing.id, { query: { enabled: owner, queryKey: getGetListingBidsQueryKey(listing.id) } });
  const bidMutation = useCreateBid();
  const accept = useAcceptBid();
  const qc = useQueryClient();
  const submitBid = (e: FormEvent) => {
    e.preventDefault();
    bidMutation.mutate({ listingId: listing.id, data: { amount: Number(amount), quantity: Number(quantity) } }, { onSuccess: () => { setBidding(false); setAmount(''); qc.invalidateQueries({ queryKey: getGetListingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetListingBidsQueryKey(listing.id) }); } });
  };
  return <Card className="flex flex-col"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">{listing.category === 'nursery' ? 'Nursery · Sree Ram Nursery Hub' : 'Crop'}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${listing.status === 'live' ? 'bg-[#dfeadd] text-primary' : 'bg-muted text-muted-foreground'}`}>{listing.status}</span></div><h3 className="mt-3 font-hindi text-xl font-semibold">{listing.crop}</h3><div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin size={13}/>{listing.location}{listing.distanceKm != null && ` · ${listing.distanceKm.toFixed(1)} km`}</div></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#edf0df] text-primary"><Sprout size={20}/></div></div><div className="mt-5 grid grid-cols-2 gap-3 border-y border-border py-4"><div><div className="text-xs text-muted-foreground">Quantity</div><div className="mt-1 font-semibold">{listing.quantity} {listing.unit}</div></div><div><div className="text-xs text-muted-foreground">Asking price</div><div className="mt-1 font-mono-data text-sm font-bold">{money(listing.askingPrice)}<span className="font-sans text-xs font-normal text-muted-foreground">/{listing.unit}</span></div></div></div>{listing.mspPrice != null && ['quintal','quintals','qtl','qtl.','100 kg'].includes(listing.unit.trim().toLowerCase()) && <div className={`mt-3 flex items-center gap-2 text-xs ${listing.askingPrice < listing.mspPrice ? 'text-[#a54d3d]' : 'text-primary'}`}><ShieldCheck size={14}/>{listing.askingPrice < listing.mspPrice ? 'Below MSP reference' : 'MSP reference'} {money(listing.mspPrice)}/quintal</div>}<div className="mt-auto pt-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{owner ? `${listing.bidCount} offer${listing.bidCount === 1 ? '' : 's'}` : listing.sellerLabel}</span>{listing.qualityScore != null && <span>Quality {listing.qualityScore}</span>}</div>{owner ? <div className="mt-3">{bids.isLoading ? <LoadingRows/> : bids.isError ? <QueryError retry={() => bids.refetch()}/> : (bids.data?.length ?? 0) === 0 ? <div className="mt-2 rounded-xl bg-muted/70 px-3 py-3 text-xs text-muted-foreground">No offers yet. Buyers can find this listing in the marketplace.</div> : <div className="mt-3 space-y-2">{bids.data?.map(b => <div key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 p-3 text-sm"><div><div className="font-semibold">{money(b.amount)} / {listing.unit}</div><div className="mt-0.5 text-xs text-muted-foreground">{b.buyerLabel} · {b.quantity} {listing.unit} · {b.status}</div></div>{b.status === 'active' && <Button className="min-h-9 px-3 text-xs" disabled={accept.isPending} onClick={() => accept.mutate({ bidId: b.id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetMyOrdersQueryKey() }); qc.invalidateQueries({ queryKey: getGetListingsQueryKey() }); qc.invalidateQueries({ queryKey: getGetListingBidsQueryKey(listing.id) }); } })}>Accept</Button>}</div>)}</div>}</div> : <>{bidding ? <form onSubmit={submitBid} className="mt-4 space-y-3 rounded-xl bg-muted/60 p-3"><div className="grid grid-cols-2 gap-2"><Field label="Offer / unit" value={amount} onChange={setAmount} type="number" min="1" required/><Field label={`Quantity (${listing.unit})`} value={quantity} onChange={setQuantity} type="number" min="0.1" step="any" required/></div>{bidMutation.isError && <p className="text-xs text-destructive">Could not send offer. Please try again.</p>}<div className="flex gap-2"><Button type="submit" className="min-h-9 flex-1" disabled={bidMutation.isPending}>{bidMutation.isPending ? 'Sending…' : 'Send offer'}</Button><Button variant="outline" className="min-h-9" onClick={() => setBidding(false)}>Cancel</Button></div></form> : <Button className="mt-4 w-full" onClick={() => setBidding(true)}>Make an offer <ArrowRight size={15}/></Button>}</>}</div></Card>;
}

function Marketplace() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [district, setDistrict] = useState('');
  const [radius, setRadius] = useState('');
  const [coordinates, setCoordinates] = useState<{latitude:number;longitude:number}|null>(null);
  const [geoMessage, setGeoMessage] = useState('');
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(category ? { category: category as 'crop' | 'nursery' } : {}), ...(district ? { district } : {}), ...(radius ? { radiusKm: Number(radius) as 10 | 25 | 50 } : {}), ...(coordinates || {}) }), [search, category, district, radius, coordinates]);
  const q = useGetListings(params);
  const locate = () => {
    if (!navigator.geolocation) { setGeoMessage('Location is not available in this browser. Search by district instead.'); return; }
    setGeoMessage('Waiting for location permission…');
    navigator.geolocation.getCurrentPosition(pos => { setCoordinates({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setGeoMessage('Nearby results use your current location for this session only.'); }, () => setGeoMessage('Location permission was unavailable. Search by district or allow location access.'), { enableHighAccuracy: false, timeout: 10000 });
  };
  return <><PageHeading eyebrow="Trade nearby / आस-पास" title="Marketplace" subtitle="Discover live crop listings and Sree Ram Nursery Hub stock shared by growers."/><Card className="mb-5 !p-3"><div className="grid gap-2 md:grid-cols-[1.4fr_.8fr_.8fr_.7fr]"><label className="relative"><Search size={17} className="absolute left-3 top-3.5 text-muted-foreground"/><input aria-label="Search crops" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search crops or location" className="h-11 w-full rounded-xl bg-muted/70 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"/></label><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value)} className="h-11 rounded-xl bg-muted/70 px-3 text-sm"><option value="">All categories</option><option value="crop">Crops</option><option value="nursery">Nursery · Sree Ram Nursery Hub</option></select><input aria-label="District" value={district} onChange={e=>setDistrict(e.target.value)} placeholder="District" className="h-11 rounded-xl bg-muted/70 px-3 text-sm outline-none"/><select aria-label="Distance filter" value={radius} onChange={e=>setRadius(e.target.value)} className="h-11 rounded-xl bg-muted/70 px-3 text-sm"><option value="">Pan-India</option><option value="10" disabled={!coordinates}>Within 10 km</option><option value="25" disabled={!coordinates}>Within 25 km</option><option value="50" disabled={!coordinates}>Within 50 km</option></select></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><Filter size={12}/>{coordinates ? 'Distance is measured from your current location for this session.' : 'Choose Pan-India, or enable location to filter nearby listings.'}</span><button onClick={locate} className="font-semibold text-primary underline-offset-2 hover:underline" data-testid="button-use-location">{coordinates ? 'Refresh location' : 'Use my location'}</button>{geoMessage && <span role="status">{geoMessage}</span>}</div></Card>{q.isLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><LoadingRows/><LoadingRows/></div> : q.isError ? <QueryError retry={() => q.refetch()}/> : !q.data?.length ? <Empty title="No listings found. Add your first crop!" message="There are no listings matching this view. You can publish your harvest and be the first to reach buyers." action={<Link href="/farmer" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Plus size={16}/> Create listing</Link>}/> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{q.data.map(l=><ListingCard key={l.id} listing={l} owner={l.isMine}/>)}</div>}</>;
}

function ListingForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<ListingInput>({ crop: '', category: 'crop', quantity: 0, unit: 'quintal', askingPrice: 0, location: '', district: '', state: 'Haryana' });
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [recording, setRecording] = useState(false);
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const recognitionRef = useRef<any>(null);
  const create = useCreateListing();
  const parse = useParseVoiceListing();
  const qc = useQueryClient();
  const set = (key: keyof ListingInput, value: string) => setForm(old => ({ ...old, [key]: ['quantity','askingPrice'].includes(key) ? Number(value) : value }));
  const toggleRecord = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { setVoiceError('Speech recognition is unavailable on this device. Type or paste your Hindi listing instead.'); return; }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return; }
    const rec = new SpeechRecognition(); recognitionRef.current = rec; rec.lang = 'hi-IN'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { const text = e.results?.[0]?.[0]?.transcript || ''; setTranscript(text); setVoiceError(''); };
    rec.onerror = () => { setVoiceError('Could not hear that clearly. Please try again or enter the listing manually.'); setRecording(false); };
    rec.onend = () => setRecording(false);
    try { rec.start(); setRecording(true); setVoiceError(''); } catch { setVoiceError('Microphone access is unavailable. You can enter the listing manually.'); }
  };
  const parseVoice = () => { if (!transcript.trim()) return; parse.mutate({ data: { transcript, language: 'hi' } }, { onSuccess: result => { setVoiceResult(result); setForm(old => ({ ...old, crop: result.crop ?? old.crop, category: result.category ?? old.category, quantity: result.quantity ?? old.quantity, unit: result.unit ?? old.unit, askingPrice: result.askingPrice ?? old.askingPrice, location: result.location ?? old.location, district: result.district ?? old.district, state: result.state ?? old.state })); } }); };
  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate({ data: form }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getGetListingsQueryKey() }); onCreated(); } }); };
  return <Card><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.15em] text-primary">Create a listing</div><h2 className="mt-1 font-hindi text-xl font-semibold">Tell buyers what’s ready</h2><p className="mt-1 text-xs text-muted-foreground">Speak in Hindi or fill in the details yourself.</p></div><span className="rounded-xl bg-secondary p-2.5 text-primary"><Plus size={19}/></span></div><div className="mt-5 rounded-2xl bg-[#edf0df] p-4"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold"><Mic size={16} className="text-primary"/> Voice listing · Hindi</div><div className="mt-1 text-xs text-muted-foreground">Haryanvi speakers can use Hindi recognition.</div></div><Button variant={recording ? 'danger' : 'soft'} className="min-h-10 px-3" onClick={toggleRecord}>{recording ? <><X size={15}/> Stop</> : <><Mic size={15}/> Speak</>}</Button></div><textarea value={transcript} onChange={e=>setTranscript(e.target.value)} rows={2} placeholder="जैसे: मेरे पास 20 क्विंटल गेहूँ है, भाव 2400 रुपये..." className="mt-3 w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"/>{voiceError && <p className="mt-2 text-xs text-destructive">{voiceError}</p>}<div className="mt-2 flex flex-wrap items-center gap-2"><Button variant="outline" className="min-h-9 px-3 text-xs" onClick={parseVoice} disabled={parse.isPending || !transcript.trim()}>{parse.isPending ? 'Understanding…' : 'Fill from voice'}</Button>{voiceResult && <span className="text-xs text-primary">{voiceResult.missingFields?.length ? `Still needed: ${voiceResult.missingFields.join(', ')}` : 'Details parsed—please review before publishing.'}</span>}</div></div><form onSubmit={submit} className="mt-5 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Crop or plant" value={form.crop} onChange={v=>set('crop',v)} placeholder="e.g. Wheat" required/><SelectField label="Listing type" value={form.category} onChange={v=>set('category',v)} options={[['crop','Crop'],['nursery','Nursery']]}/><Field label="Quantity" value={form.quantity || ''} onChange={v=>set('quantity',v)} type="number" min="0.1" step="any" required/><Field label="Unit" value={form.unit} onChange={v=>set('unit',v)} placeholder="quintal, kg, plants"/><Field label="Asking price per unit (₹)" value={form.askingPrice || ''} onChange={v=>set('askingPrice',v)} type="number" min="0" required/><Field label="Village / location" value={form.location} onChange={v=>set('location',v)} placeholder="Your village or market" required/><Field label="District" value={form.district || ''} onChange={v=>set('district',v)} placeholder="District"/><Field label="State" value={form.state || ''} onChange={v=>set('state',v)} placeholder="State"/></div>{create.isError && <p className="text-sm text-destructive">Could not publish this listing. Check the details and retry.</p>}<Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? 'Publishing…' : 'Publish listing'} <ArrowRight size={15}/></Button></form></Card>;
}
function Farmer() {
  const [showForm, setShowForm] = useState(false);
  const q = useGetListings();
  const profile = useGetMyProfile();
  const ownListings = q.data?.filter(l => l.isMine && l.status !== 'withdrawn') ?? [];
  return <><PageHeading eyebrow="Your harvest / आपकी फसल" title="Manage listings" subtitle="Publish produce, review offers and choose the deal that works for you." action={<Button onClick={() => setShowForm(!showForm)}><Plus size={16}/>{showForm ? 'Close form' : 'Add listing'}</Button>}/>{showForm && <div className="mb-6"><ListingForm onCreated={() => setShowForm(false)}/></div>}{q.isLoading || profile.isLoading ? <LoadingRows/> : q.isError || profile.isError ? <QueryError retry={() => { q.refetch(); profile.refetch(); }}/> : ownListings.length === 0 ? <Empty title="No listings found. Add your first crop!" message="List what is ready to reach buyers. Voice input in Hindi is available, and you can always type the details." action={<Button onClick={() => setShowForm(true)}><Plus size={16}/> Create your first listing</Button>}/> : <><div className="mb-4 flex items-center justify-between text-sm text-muted-foreground"><span>{ownListings.length} listing{ownListings.length === 1 ? '' : 's'} available</span><span>Offers are revealed to you as they arrive</span></div><div className="grid gap-4 lg:grid-cols-2">{ownListings.map(l=><ListingCard key={l.id} listing={l} owner/>)}</div></>}</>;
}

function DealContact({ order }: { order: Order }) {
  const q = useGetOrderContact(order.id, { query: { enabled: Boolean(order.dealLockedAt), queryKey: getGetOrderContactQueryKey(order.id) } });
  return <div className="mt-4 rounded-xl bg-[#edf0df] p-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-primary"><ShieldCheck size={15}/> Deal locked · contact available</div>{q.isLoading ? <div className="mt-3 h-10 animate-pulse rounded-lg bg-card"/> : q.isError ? <div className="mt-3 text-sm text-muted-foreground">Contact details are temporarily unavailable. <button onClick={() => q.refetch()} className="font-semibold text-primary">Retry</button></div> : q.data && <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">Name</div><strong>{q.data.name}</strong></div><div><div className="text-xs text-muted-foreground">Phone</div><a href={`tel:${q.data.phone}`} className="font-semibold text-primary">{q.data.phone}</a></div>{q.data.businessName && <div><div className="text-xs text-muted-foreground">Business</div><strong>{q.data.businessName}</strong></div>}{q.data.gstin && <div><div className="text-xs text-muted-foreground">GSTIN</div><strong>{q.data.gstin}</strong></div>}</div>}</div>;
}
function Orders() {
  const q = useGetMyOrders();
  return <><PageHeading eyebrow="Trade records / सौदे" title="Your deals" subtitle="Accepted offers, quantities and settlement records in one place."/><div className="mb-5 flex items-center gap-3 rounded-2xl border border-[#d9dfc9] bg-[#edf0df] p-4"><ShieldCheck size={21} className="shrink-0 text-primary"/><p className="text-sm leading-6">Counterpart contact is kept masked until a deal is locked. We never expose contact details before acceptance.</p></div>{q.isLoading ? <LoadingRows/> : q.isError ? <QueryError retry={() => q.refetch()}/> : !q.data?.length ? <Empty title="No locked deals yet" message="When a buyer's offer is accepted, your deal will appear here. You can compare offers from your listings." action={<Link href="/farmer" className="text-sm font-semibold text-primary">Review your listings <ArrowRight size={15} className="inline"/></Link>}/> : <div className="space-y-4">{q.data.map(o=><Card key={o.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><span className="rounded-full bg-[#dfeadd] px-2.5 py-1 text-[11px] font-semibold capitalize text-primary">{o.status}</span><span className="text-xs text-muted-foreground">Locked {shortDate(o.dealLockedAt)}</span></div><h2 className="mt-3 font-hindi text-xl font-semibold">{o.crop}</h2><div className="mt-1 text-sm text-muted-foreground">{o.quantity} units · {o.partnerLabel}</div></div><div className="rounded-xl bg-secondary/70 px-4 py-3 sm:text-right"><div className="text-xs text-muted-foreground">Total deal amount</div><div className="mt-1 font-mono-data text-lg font-bold">{money(o.totalAmount)}</div></div></div>{o.taxAmount != null && <div className="mt-4 flex justify-between border-t border-border pt-3 text-sm"><span className="text-muted-foreground">Tax recorded</span><strong>{money(o.taxAmount)}</strong></div>}<DealContact order={o}/></Card>)}</div>}</>;
}

function Government() {
  const overview = useGetGovernmentOverview();
  const prices = useGetMspPrices();
  const taxRules = useGetMandiTaxRules();
  const profile = useGetMyProfile();
  const createMsp = useCreateMspPrice();
  const createTaxRule = useCreateMandiTaxRule();
  const queryClient = useQueryClient();
  const isMandiAdmin = ['admin', 'mandi_admin'].includes(profile.data?.profile?.role ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const [mspForm, setMspForm] = useState({
    crop: '',
    state: '',
    mandi: '',
    pricePerQuintal: '',
    effectiveDate: today,
    source: '',
  });
  const [taxForm, setTaxForm] = useState({
    state: '',
    taxRate: '',
    effectiveDate: today,
    source: '',
  });

  const saveMsp = (event: FormEvent) => {
    event.preventDefault();
    createMsp.mutate(
      {
        data: {
          crop: mspForm.crop.trim(),
          state: mspForm.state.trim(),
          mandi: mspForm.mandi.trim() || null,
          pricePerQuintal: Number(mspForm.pricePerQuintal),
          effectiveDate: mspForm.effectiveDate,
          source: mspForm.source.trim(),
        },
      },
      {
        onSuccess: () => {
          setMspForm((form) => ({
            ...form,
            crop: '',
            mandi: '',
            pricePerQuintal: '',
            source: '',
          }));
          void queryClient.invalidateQueries();
        },
      },
    );
  };

  const saveTaxRule = (event: FormEvent) => {
    event.preventDefault();
    createTaxRule.mutate(
      {
        data: {
          state: taxForm.state.trim(),
          taxRate: Number(taxForm.taxRate),
          effectiveDate: taxForm.effectiveDate,
          source: taxForm.source.trim(),
        },
      },
      {
        onSuccess: () => {
          setTaxForm((form) => ({ ...form, state: '', taxRate: '', source: '' }));
          void queryClient.invalidateQueries();
        },
      },
    );
  };

  return (
    <>
      <PageHeading
        eyebrow="Public records / सरकारी रिकॉर्ड"
        title="MSP & mandi"
        subtitle="Government-provided support prices, mandi tax rules, and marketplace trade aggregates."
      />
      <div className="grid gap-4 md:grid-cols-[.7fr_1.3fr]">
        <Card className="bg-[#edf0df]">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-primary">
            <ShieldCheck size={16} /> Transparent records
          </div>
          <h2 className="mt-3 font-hindi text-2xl font-semibold">
            Know the reference.<br />Make your own call.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            MSP is a reference for eligible crops—not a guarantee of a buyer offer.
            Check the effective date and source for each record.
          </p>
        </Card>
        <Card>
          {overview.isLoading ? (
            <LoadingRows />
          ) : overview.isError ? (
            <QueryError retry={() => overview.refetch()} />
          ) : overview.data ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ['Growers', overview.data.farmerCount],
                ['Buyers', overview.data.buyerCount],
                ['Live listings', overview.data.listingCount],
                ['Active bids', overview.data.activeBidCount],
                ['Settled value', money(overview.data.settledValue)],
                ['Tax tracked', money(overview.data.taxTracked)],
                ['MSP alerts', overview.data.mspAlertCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-muted/65 p-3">
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-2 font-mono-data text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      {isMandiAdmin && (
        <section className="mt-6 grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <div className="text-xs font-bold uppercase tracking-[.14em] text-primary">
              Authorized administration
            </div>
            <h2 className="mt-1 font-hindi text-xl font-semibold">Add an MSP reference</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every record requires its source and effective date.
            </p>
            <form onSubmit={saveMsp} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Crop" value={mspForm.crop} onChange={(crop) => setMspForm({ ...mspForm, crop })} required />
                <Field label="State" value={mspForm.state} onChange={(state) => setMspForm({ ...mspForm, state })} required />
                <Field label="Mandi (optional)" value={mspForm.mandi} onChange={(mandi) => setMspForm({ ...mspForm, mandi })} />
                <Field label="Price per quintal (₹)" value={mspForm.pricePerQuintal} onChange={(pricePerQuintal) => setMspForm({ ...mspForm, pricePerQuintal })} type="number" min="0.01" step="0.01" required />
                <Field label="Effective date" value={mspForm.effectiveDate} onChange={(effectiveDate) => setMspForm({ ...mspForm, effectiveDate })} type="date" required />
                <Field label="Official source" value={mspForm.source} onChange={(source) => setMspForm({ ...mspForm, source })} required />
              </div>
              {createMsp.isError && <p className="text-sm text-destructive">Could not save this MSP record. Check for an existing record with the same effective date.</p>}
              <Button type="submit" disabled={createMsp.isPending}>
                {createMsp.isPending ? 'Saving…' : 'Save MSP record'}
              </Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-hindi text-xl font-semibold">Add a mandi tax rule</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This rate is used for transparent trade tracking and is not legal or tax advice.
            </p>
            <form onSubmit={saveTaxRule} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="State" value={taxForm.state} onChange={(state) => setTaxForm({ ...taxForm, state })} required />
                <Field label="Tax rate (%)" value={taxForm.taxRate} onChange={(taxRate) => setTaxForm({ ...taxForm, taxRate })} type="number" min="0" max="100" step="0.0001" required />
                <Field label="Effective date" value={taxForm.effectiveDate} onChange={(effectiveDate) => setTaxForm({ ...taxForm, effectiveDate })} type="date" required />
                <Field label="Official source" value={taxForm.source} onChange={(source) => setTaxForm({ ...taxForm, source })} required />
              </div>
              {createTaxRule.isError && <p className="text-sm text-destructive">Could not save this tax rule. Check for a rule with the same state and effective date.</p>}
              <Button type="submit" disabled={createTaxRule.isPending}>
                {createTaxRule.isPending ? 'Saving…' : 'Save tax rule'}
              </Button>
            </form>
          </Card>
        </section>
      )}

      <div className="mb-3 mt-8 flex items-end justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[.14em] text-primary">
            Government support prices
          </div>
          <h2 className="mt-1 font-hindi text-2xl font-semibold">Minimum Support Price</h2>
        </div>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <Clock3 size={14} /> Effective dates shown per record
        </span>
      </div>
      {prices.isLoading ? (
        <LoadingRows />
      ) : prices.isError ? (
        <QueryError retry={() => prices.refetch()} />
      ) : !prices.data?.length ? (
        <Empty
          title="No MSP records available"
          message="Government price data will appear here when authorized administrators publish current records."
        />
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr] bg-muted/70 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid">
            <div>Crop</div><div>State / mandi</div><div>Price per quintal</div><div>Effective</div>
          </div>
          <div className="divide-y divide-border">
            {prices.data.map((price) => (
              <div key={price.id} className="grid gap-1 px-5 py-4 text-sm sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:items-center">
                <div className="font-hindi font-semibold">
                  {price.crop}
                  <div className="text-xs font-normal text-muted-foreground sm:hidden">{price.mandi || price.state}</div>
                </div>
                <div className="hidden text-muted-foreground sm:block">{price.state} · {price.mandi || 'State-wide'}</div>
                <div className="font-mono-data font-bold">
                  {money(price.pricePerQuintal)}
                  <span className="font-sans text-xs font-normal text-muted-foreground">/qtl</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground sm:block">
                  {shortDate(price.effectiveDate)}
                  <span className="sm:hidden">Source: {price.source}</span>
                </div>
                <div className="hidden text-xs text-muted-foreground sm:col-span-4 sm:block">Source: {price.source}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-3 mt-8">
        <div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Mandi rules</div>
        <h2 className="mt-1 font-hindi text-2xl font-semibold">Current mandi tax rates</h2>
      </div>
      {taxRules.isLoading ? (
        <LoadingRows />
      ) : taxRules.isError ? (
        <QueryError retry={() => taxRules.refetch()} />
      ) : !taxRules.data?.length ? (
        <Empty
          title="No mandi tax rules available"
          message="Current rates will appear here when authorized administrators publish them."
        />
      ) : (
        <Card className="overflow-hidden !p-0">
          <div className="hidden grid-cols-[1fr_1fr_1fr_2fr] bg-muted/70 px-5 py-3 text-xs font-semibold text-muted-foreground sm:grid">
            <div>State</div><div>Rate</div><div>Effective</div><div>Official source</div>
          </div>
          <div className="divide-y divide-border">
            {taxRules.data.map((rule) => (
              <div key={rule.id} className="grid gap-1 px-5 py-4 text-sm sm:grid-cols-[1fr_1fr_1fr_2fr] sm:items-center">
                <strong>{rule.state}</strong>
                <span>{rule.taxRate}%</span>
                <span className="text-xs text-muted-foreground">{shortDate(rule.effectiveDate)}</span>
                <span className="text-xs text-muted-foreground">{rule.source}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Ledger() {
  const q = useGetLedgerEntries();
  const add = useCreateLedgerEntry();
  const del = useDeleteLedgerEntry();
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: 'diesel', description: '', amount: '', hours: '', entryDate: new Date().toISOString().slice(0,10) });
  const entries = q.data ?? [];
  const total = entries.reduce((sum, e) => sum + e.amount, 0);
  const submit = (e: FormEvent) => { e.preventDefault(); add.mutate({ data: { category: form.category as any, description: form.description, amount: Number(form.amount), hours: form.hours ? Number(form.hours) : null, entryDate: form.entryDate } }, { onSuccess: () => { setForm(f => ({...f, description:'', amount:'', hours:''})); qc.invalidateQueries({queryKey:getGetLedgerEntriesQueryKey()}); } }); };
  return <><PageHeading eyebrow="Private farm account / निजी हिसाब" title="KhetKhata" subtitle="Your farm expenses, recorded for you. No one else can see this ledger."/><div className="mb-5 grid gap-4 sm:grid-cols-[1.25fr_.75fr]"><Card className="bg-[#edf0df]"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-primary"><BookOpen size={16}/> खेतखाता</div><h2 className="mt-2 font-hindi text-xl font-semibold">A clear account of your inputs.</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Add fuel, labour, fertilizer or machinery costs as they happen. Records stay private to your account.</p></Card><Card><div className="text-xs text-muted-foreground">Recorded expenses</div><div className="mt-2 font-mono-data text-3xl font-bold">{q.isLoading ? '—' : money(total)}</div><div className="mt-1 text-xs text-muted-foreground">{entries.length} entries recorded</div></Card></div><div className="grid items-start gap-5 lg:grid-cols-[.8fr_1.2fr]"><Card><h2 className="font-hindi text-xl font-semibold">Add an expense</h2><form onSubmit={submit} className="mt-4 space-y-3"><SelectField label="Category" value={form.category} onChange={v=>setForm({...form,category:v})} options={[['diesel','Diesel'],['labor','Labour'],['fertilizer','Fertilizer'],['tractor','Tractor'],['other','Other']]}/><Field label="Description" value={form.description} onChange={v=>setForm({...form,description:v})} placeholder="What was this expense for?" required/><div className="grid grid-cols-2 gap-3"><Field label="Amount (₹)" value={form.amount} onChange={v=>setForm({...form,amount:v})} type="number" min="0.01" step="any" required/><Field label="Hours (optional)" value={form.hours} onChange={v=>setForm({...form,hours:v})} type="number" min="0" step="any"/></div><Field label="Date" value={form.entryDate} onChange={v=>setForm({...form,entryDate:v})} type="date" required/>{add.isError && <p className="text-sm text-destructive">Could not save this entry. Please retry.</p>}<Button type="submit" className="w-full" disabled={add.isPending}>{add.isPending ? 'Saving…' : 'Save to KhetKhata'}</Button></form></Card><Card><div className="mb-4 flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-[.14em] text-primary">Your records</div><h2 className="mt-1 font-hindi text-xl font-semibold">Expense entries</h2></div><span className="rounded-full bg-secondary px-3 py-1 text-xs">{entries.length} total</span></div>{q.isLoading ? <LoadingRows/> : q.isError ? <QueryError retry={() => q.refetch()}/> : entries.length === 0 ? <Empty title="No entries yet" message="Add your first farm expense to begin your private ledger."/> : <div className="divide-y divide-border">{entries.map((entry: LedgerEntry)=><div key={entry.id} className="flex items-center gap-3 py-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Tractor size={18}/></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{entry.description}</div><div className="mt-1 text-xs capitalize text-muted-foreground">{entry.category} · {shortDate(entry.entryDate)}{entry.hours != null && ` · ${entry.hours} hours`}</div></div><div className="font-mono-data text-sm font-bold">{money(entry.amount)}</div><button aria-label="Delete ledger entry" disabled={del.isPending} onClick={() => { if (window.confirm('Delete this private ledger entry?')) del.mutate({entryId:entry.id},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetLedgerEntriesQueryKey()})}); }} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16}/></button></div>)}</div>}</Card></div></>;
}

type SpeechResult = { transcript?: string };
type SpeechResultEvent = { results?: ArrayLike<ArrayLike<SpeechResult>> };
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

function SpeechToTextButton({ language, onText }: { language: string; onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<BrowserSpeechRecognition | null>(null);
  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice typing is not available in this browser. You can type your question.');
      return;
    }
    const next = new SpeechRecognition();
    recognition.current = next;
    next.lang = language === 'en' ? 'en-IN' : 'hi-IN';
    next.continuous = false;
    next.interimResults = false;
    next.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) onText(text);
      setError('');
    };
    next.onerror = () => {
      setError('Could not hear that clearly. Try again or type your question.');
      setListening(false);
    };
    next.onend = () => setListening(false);
    try {
      next.start();
      setListening(true);
      setError('');
    } catch {
      setError('Microphone access is unavailable. You can type your question.');
    }
  };
  useEffect(() => () => recognition.current?.stop(), []);
  return <div className="flex flex-col items-end gap-1">
    <Button variant={listening ? 'danger' : 'outline'} className="min-h-11 px-3" onClick={toggle} aria-pressed={listening} aria-label={listening ? 'Stop voice input' : 'Speak your question'}>
      {listening ? <X size={16}/> : <Mic size={16}/>}<span className="hidden sm:inline">{listening ? 'Stop' : 'Speak'}</span>
    </Button>
    {error && <span role="status" className="max-w-48 text-right text-[10px] leading-4 text-destructive">{error}</span>}
  </div>;
}

function SpeakReplyButton({ text, language }: { text: string; language: string }) {
  const [error, setError] = useState('');
  const speak = () => {
    if (!('speechSynthesis' in window)) {
      setError('Spoken replies are not available in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-IN' : 'hi-IN';
    window.speechSynthesis.speak(utterance);
    setError('');
  };
  return <div className="mt-2">
    <Button variant="soft" className="min-h-9 px-3 text-xs" onClick={speak}><Volume2 size={14}/> Read aloud</Button>
    {error && <span className="ml-2 text-[10px] text-muted-foreground">{error}</span>}
  </div>;
}

function CropDoctor() {
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState('hi');
  const [reply, setReply] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const assistant = useAskFarmAssistant();
  const diagnose = useDiagnoseCropImage();
  const ask = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    assistant.mutate({ data: { message: question, language: language as 'hi' | 'haryanvi' | 'en' } }, {
      onSuccess: (result) => { setReply(result.reply); setQuestion(''); },
    });
  };
  const imageSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result).split(',')[1];
      diagnose.mutate({
        data: { imageBase64: raw, mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp', language: language as 'hi' | 'haryanvi' | 'en' },
      }, { onSuccess: setDiagnosis });
    };
    reader.readAsDataURL(file);
  };
  return <>
    <PageHeading eyebrow="Farm support / फसल सलाह" title="Crop doctor" subtitle="Ask a growing question or share a crop photo for AI-assisted guidance."/>
    <div className="grid items-start gap-5 lg:grid-cols-[.9fr_1.1fr]">
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf0df] text-primary"><Camera size={20}/></span>
          <div><h2 className="font-hindi text-xl font-semibold">Photo diagnosis</h2><p className="text-xs text-muted-foreground">Clear images help the assistant assess visible symptoms.</p></div>
        </div>
        <form onSubmit={imageSubmit} className="mt-5">
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/50 px-4 text-center hover:bg-muted">
            <Camera size={23} className="text-primary"/><span className="mt-2 text-sm font-semibold">{file?.name || 'Choose a crop photo'}</span><span className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP · photos are processed for this request only</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={e => { setFile(e.target.files?.[0] || null); setDiagnosis(null); }}/>
          </label>
          <div className="mt-3"><SelectField label="Response language" value={language} onChange={setLanguage} options={ [['hi','हिन्दी'],['haryanvi','Haryanvi'],['en','English']] }/></div>
          {diagnose.isError && <p className="mt-3 text-sm text-destructive">Diagnosis unavailable. Please try a clear supported image again.</p>}
          <Button type="submit" className="mt-4 w-full" disabled={!file || diagnose.isPending}>{diagnose.isPending ? 'Reviewing image…' : 'Get crop guidance'}</Button>
        </form>
        {diagnosis && <div className="mt-5 rounded-xl bg-[#edf0df] p-4">
          <div className="flex items-center justify-between"><strong className="font-hindi">{diagnosis.diagnosis}</strong><span className="rounded-full bg-card px-2 py-1 text-xs capitalize">{diagnosis.severity}</span></div>
          {diagnosis.confidence != null && <p className="mt-1 text-xs text-muted-foreground">Confidence: {Math.round(diagnosis.confidence * 100)}%</p>}
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{diagnosis.recommendations.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul>
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{diagnosis.caution}</p>
        </div>}
      </Card>
      <Card className="flex min-h-[430px] flex-col">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Volume2 size={20}/></span>
          <div><h2 className="font-hindi text-xl font-semibold">Ask the farm assistant</h2><p className="text-xs text-muted-foreground">Speak or type in Hindi, Haryanvi or English · AI-assisted, not a substitute for local expertise</p></div>
        </div>
        <div className="flex-1 py-5">
          {reply ? <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-[#edf0df] p-4 text-sm leading-6">{reply}<SpeakReplyButton text={reply} language={language}/></div> : <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <CircleHelp size={25} className="text-primary"/><p className="mt-3 font-hindi text-lg font-semibold">आज खेती में क्या मदद चाहिए?</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Ask about crop care, irrigation, pests or seasonal practices.</p>
          </div>}
          {assistant.isError && <p className="mt-3 text-sm text-destructive">Could not get advice right now. Please try again.</p>}
        </div>
        <form onSubmit={ask} className="flex items-end gap-2 border-t border-border pt-4">
          <textarea rows={2} value={question} onChange={e => setQuestion(e.target.value)} placeholder="अपना सवाल यहाँ लिखें…" className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/25"/>
          <SpeechToTextButton language={language} onText={setQuestion}/>
          <Button type="submit" className="min-h-11 self-end px-3" disabled={assistant.isPending || !question.trim()} aria-label="Send question">{assistant.isPending ? <LoaderCircle className="animate-spin" size={18}/> : <Send size={17}/>}</Button>
        </form>
      </Card>
    </div>
  </>;
}

function Profile() {
  const q=useGetMyProfile();
  const save=useSaveMyProfile();
  const qc=useQueryClient();
  const [form,setForm]=useState({displayName:'',role:'farmer',phone:'',gstin:'',businessName:'',district:'',state:'Haryana'});
  const init=useRef(false);
  useEffect(()=>{if(q.data?.profile&&!init.current){init.current=true;const p=q.data.profile;setForm({displayName:p.displayName,role:p.role==='buyer'?'buyer':'farmer',phone:p.phone||'',gstin:p.gstin||'',businessName:p.businessName||'',district:p.district||'',state:p.state||''});}},[q.data]);
  const submit=(e:FormEvent)=>{e.preventDefault();save.mutate({data:{...form,role:form.role as 'farmer'|'buyer'}},{onSuccess:()=>qc.invalidateQueries({queryKey:getGetMyProfileQueryKey()})});};
  if(q.isLoading)return <LoadingRows/>;
  if(q.isError)return <QueryError retry={()=>q.refetch()}/>;
  return <><PageHeading eyebrow="Your account / आपका खाता" title="Profile" subtitle="Manage the details buyers see on your public listings."/><div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><Card className="bg-[#edf0df]"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-card text-primary"><UserRound size={24}/></div><h2 className="mt-4 font-hindi text-xl font-semibold">{q.data?.profile?.displayName || 'Complete your profile'}</h2><p className="mt-1 text-sm text-muted-foreground">{q.data?.profile?.verified ? 'Verified profile' : 'Profile not verified'}</p><div className="mt-4 flex items-center gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck size={15} className="shrink-0 text-primary"/>Only your own profile can be edited here. Aadhaar and bank details are never requested.</div></Card><Card><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Display name" value={form.displayName} onChange={v=>setForm({...form,displayName:v})} required/><SelectField label="I am a" value={form.role} onChange={v=>setForm({...form,role:v})} options={[['farmer','Farmer'],['buyer','Buyer']]}/><Field label="Phone" value={form.phone} onChange={v=>setForm({...form,phone:v})} placeholder="Phone number" required/><Field label="Business name (optional)" value={form.businessName} onChange={v=>setForm({...form,businessName:v})}/><Field label="GSTIN (optional)" value={form.gstin} onChange={v=>setForm({...form,gstin:v})}/><Field label="District" value={form.district} onChange={v=>setForm({...form,district:v})}/><Field label="State" value={form.state} onChange={v=>setForm({...form,state:v})}/></div>{save.isError && <p className="text-sm text-destructive">Could not save your profile. Please check and retry.</p>}{save.isSuccess && <p className="text-sm font-medium text-primary">Profile saved.</p>}<Button type="submit" disabled={save.isPending}>{save.isPending?'Saving…':'Save profile'} <Check size={16}/></Button></form></Card></div></>;
}

function Router() {
  const [,setLocation]=useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{signIn:{start:{title:'Welcome back',subtitle:'Sign in to your Smart Kisan account'}},signUp:{start:{title:'Join Smart Kisan',subtitle:'Create an account for your farm'}}}} routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}><QueryClientProvider client={queryClient}><MarketplaceRealtime/><ClerkQueryClientCacheInvalidator/><Switch><Route path="/" component={HomeRedirect}/><Route path="/sign-in/*?" component={SignInPage}/><Route path="/sign-up/*?" component={SignUpPage}/><Route path="/dashboard">{()=><Authed><Dashboard/></Authed>}</Route><Route path="/marketplace">{()=><Authed><Marketplace/></Authed>}</Route><Route path="/farmer">{()=><Authed><Farmer/></Authed>}</Route><Route path="/orders">{()=><Authed><Orders/></Authed>}</Route><Route path="/government">{()=><Authed><Government/></Authed>}</Route><Route path="/ledger">{()=><Authed><Ledger/></Authed>}</Route><Route path="/crop-doctor">{()=><Authed><CropDoctor/></Authed>}</Route><Route path="/profile">{()=><Authed><Profile/></Authed>}</Route><Route component={NotFound}/></Switch></QueryClientProvider></ClerkProvider>;
}
function App() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: `${basePath || ''}/` })
      .catch((error: unknown) =>
        console.error('Smart Kisan service worker registration failed:', error),
      );
  }, []);

  return <WouterRouter base={basePath}><Router/></WouterRouter>;
}
export default App;
