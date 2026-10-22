import { Bike, Footprints, Car, ShieldCheck, ShoppingBasket, Package, Timer, Store, Truck } from 'lucide-react'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { ERRAND_CATEGORIES } from '@/features/errands/catalog'

const steps = [
  { title: 'Post your errand', text: 'Say what you need and where. You see the price before you confirm.' },
  { title: 'A verified runner accepts', text: 'Approved runners nearby see your request and one of them takes it.' },
  { title: 'Follow it and confirm', text: 'Watch progress, share the delivery code, then rate your runner.' },
]

const categoryIcons = [Package, ShoppingBasket, Store, Timer, Truck]

const safety = [
  'Runners are reviewed by a person before they can accept jobs.',
  'Your exact address and phone number are shared only with the runner who takes your errand.',
  'Prices are shown up front and never rise without your approval.',
  'Some things are never allowed on the platform, and runners can report unsafe requests.',
]

const faqs = [
  {
    q: 'Where does UseMe work?',
    a: 'Jalingo, Taraba State. More towns come later, after Jalingo works well.',
  },
  {
    q: 'Do runners need a vehicle?',
    a: 'No. Walking and bicycle runners handle short errands. Keke, motorcycle and car runners take longer ones.',
  },
  {
    q: 'How do I pay?',
    a: 'Cash to the runner at launch. Card and transfer payments come in a later release.',
  },
  {
    q: 'What if something goes wrong?',
    a: 'You can report a problem on any errand. A person at UseMe reviews it.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Account">
          <ButtonLink to="/login" variant="ghost">
            Sign in
          </ButtonLink>
          <ButtonLink to="/register">Get started</ButtonLink>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 pb-10 pt-6 md:pt-14">
          <p className="inline-block rounded-full bg-brand-yellow px-3 py-1 text-sm font-bold">Now planning in Jalingo</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
            Your Errand. <span className="text-brand-red">Our Runner.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">
            Post an errand and a verified local runner picks it up. Deliveries, shopping, market runs and more, with the
            price shown before you commit.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink to="/register" size="lg">
              Request an errand
            </ButtonLink>
            <ButtonLink to="/become-a-runner" size="lg" variant="dark">
              Become a runner
            </ButtonLink>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-soft" aria-label="Runner types">
            <span className="inline-flex items-center gap-1.5"><Footprints className="size-4" aria-hidden="true" />On foot</span>
            <span className="inline-flex items-center gap-1.5"><Bike className="size-4" aria-hidden="true" />Bicycle, motorcycle, keke</span>
            <span className="inline-flex items-center gap-1.5"><Car className="size-4" aria-hidden="true" />Car</span>
          </div>
        </section>

        <section className="bg-canvas py-10">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-extrabold">How it works</h2>
            <ol className="mt-5 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="rounded-card border border-line bg-surface p-4 shadow-card">
                  <span className="grid size-8 place-items-center rounded-full bg-brand-red font-bold text-white">{index + 1}</span>
                  <h3 className="mt-3 font-bold">{step.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="text-2xl font-extrabold">What you can ask for</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {ERRAND_CATEGORIES.map((category, index) => {
              const Icon = categoryIcons[index] ?? Package
              return (
                <li key={category.id} className="flex gap-3 rounded-card border border-line p-4">
                  <Icon className="mt-0.5 size-6 shrink-0 text-brand-red" aria-hidden="true" />
                  <div>
                    <h3 className="font-bold">{category.label}</h3>
                    <p className="text-sm text-ink-soft">{category.description}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="bg-ink py-10 text-white">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold">
              <ShieldCheck className="size-7 text-brand-yellow" aria-hidden="true" />
              Built around trust
            </h2>
            <ul className="mt-5 grid gap-3 md:grid-cols-2">
              {safety.map((item) => (
                <li key={item} className="rounded-card border border-white/15 p-4 text-white/90">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-10">
          <h2 className="text-2xl font-extrabold">Questions</h2>
          <div className="mt-4 divide-y divide-line rounded-card border border-line">
            {faqs.map((item) => (
              <details key={item.q} className="group p-4">
                <summary className="min-h-6 cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-2 text-ink-soft">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-5xl space-y-1 px-4 py-6 text-sm text-ink-soft">
          <p className="font-semibold text-ink">UseMe Courier Service</p>
          <p>Jalingo, Taraba State, Nigeria.</p>
          <p>Support contact details will be published here before launch.</p>
        </div>
      </footer>
    </div>
  )
}
