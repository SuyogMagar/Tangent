import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // phase 0: intro/centered, phase 1: moving/settled, phase 2: fully settled (show UI)
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Start transition to top-left after 2.5s
    const t1 = setTimeout(() => setPhase(1), 2500);
    // Show additional UI elements after text is settled (4.0s)
    const t2 = setTimeout(() => setPhase(2), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isCentered = phase === 0;

  return (
    <section id="top" ref={ref} className="relative min-h-screen flex items-center">
      <motion.div
        style={{ y, opacity }}
        className={`w-full relative z-10 px-8 md:px-16 lg:px-24 flex ${isCentered ? "justify-center" : "justify-start"}`}
      >
        <motion.div 
          layout
          transition={{ duration: 1.5, ease: [0.25, 1, 0.15, 1] }} 
          className="text-left"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 2 ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="mb-6 h-4"
          >
            {phase === 2 && (
              <motion.p
                initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.8 }}
                className="text-xs uppercase tracking-[0.3em] text-primary"
              >
                Advanced Materials · Est. 2014
              </motion.p>
            )}
          </motion.div>
          
          <motion.div layout className="max-w-3xl">
            <motion.h1
              layout
              initial={{ opacity: 0, y: 30, filter: "blur(12px)", scale: 1.0 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                filter: "blur(0px)", 
                scale: isCentered ? 1.0 : 0.85 
              }}
              style={{ originX: isCentered ? 0.5 : 0, originY: 0.5 }}
              transition={{ 
                layout: { duration: 1.5, ease: [0.25, 1, 0.15, 1] },
                scale: { duration: 1.5, ease: [0.25, 1, 0.15, 1] },
                opacity: { duration: 1.4, ease: "easeOut" },
                filter: { duration: 1.4, ease: "easeOut" },
                y: { duration: 1.4, ease: "easeOut" }
              }}
              className="text-5xl md:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-bold leading-[0.9]"
            >
              Engineered <span className="text-gradient">at the edge</span> of matter.
            </motion.h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 2 ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className="mt-10 h-14"
          >
            {phase === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="flex flex-wrap gap-3"
              >
                <a
                  href="#carbon"
                  className="px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-glow hover:scale-[1.02] transition"
                >
                  Explore materials
                </a>
                <a
                  href="#process"
                  className="px-5 py-3 rounded-full border border-border/60 hover:bg-secondary transition"
                >
                  See process
                </a>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 2 ? 1 : 0 }}
        transition={{ duration: 0.8 }}
        className="absolute bottom-10 inset-x-0 flex justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground"
      >
        Scroll
      </motion.div>
    </section>
  );
}

export function CarbonSection() {
  return (
    <section id="carbon" className="relative min-h-screen flex items-center px-6 py-32">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-12 gap-6 items-center">
        <div className="col-span-12 md:col-span-6 text-left">
          <Reveal>
            <span className="text-xs uppercase tracking-[0.3em] text-accent">01 — Carbon Fiber</span>
            <h2 className="mt-4 text-5xl md:text-7xl font-bold leading-[1.02]">
              Lighter than aluminum. Stronger than steel.
            </h2>
            <p className="mt-8 text-muted-foreground text-lg max-w-md">
              Our continuous tow carbon fiber delivers a tensile strength of 6.4 GPa and
              modulus up to 350 GPa — woven for aerospace, motorsport, and defense.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                { k: "6.4", v: "GPa tensile" },
                { k: "350", v: "GPa modulus" },
                { k: "1.8", v: "g/cm³ density" },
              ].map((s) => (
                <div key={s.v} className="p-4 rounded-xl bg-card/60 backdrop-blur border border-border/50">
                  <div className="text-3xl font-display font-bold text-gradient">{s.k}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        {/* Right reserved for 3D orb */}
        <div className="hidden md:block md:col-span-6" aria-hidden="true" />
      </div>
    </section>
  );
}

export function ChemicalsSection() {
  const items = [
    { name: "Cyclohexane Derivatives", purity: "99.99%" },
    { name: "Silane Coupling Agents", purity: "99.95%" },
    { name: "Epoxy Resin Precursors", purity: "99.9%" },
    { name: "High-Purity Solvents", purity: "99.99%" },
  ];
  return (
    <section id="chemicals" className="relative min-h-screen flex items-center px-6 py-32">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-12 gap-6 items-center">
        <div className="col-span-12 md:col-span-6 text-left">
          <Reveal>
            <span className="text-xs uppercase tracking-[0.3em] text-accent">02 — Chemicals</span>
            <h2 className="mt-4 text-5xl md:text-6xl font-bold leading-[1.02]">
              Molecules <span className="text-gradient">refined</span> to a vanishing tolerance.
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border/40 rounded-2xl overflow-hidden max-w-xl">
            {items.map((it, i) => (
              <Reveal key={it.name} delay={i * 0.08}>
                <div className="bg-card/70 backdrop-blur p-6 h-full hover:bg-card transition">
                  <div className="flex items-baseline justify-between">
                    <div className="text-3xl font-display font-bold text-gradient">0{i + 1}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest">{it.purity}</div>
                  </div>
                  <div className="mt-6 text-lg font-display">{it.name}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="hidden md:block md:col-span-6" aria-hidden="true" />
      </div>
    </section>
  );
}

export function ProcessSection() {
  const steps = [
    { n: "01", t: "Polymerize", d: "PAN precursor synthesized under inert atmosphere." },
    { n: "02", t: "Spin & Stabilize", d: "Continuous wet-spun filaments oxidized at 300°C." },
    { n: "03", t: "Carbonize", d: "Thermal conversion to 95%+ pure carbon at 1600°C." },
    { n: "04", t: "Surface Treat", d: "Sized for resin compatibility and lab-tested." },
  ];
  return (
    <section id="process" className="relative min-h-screen flex items-center px-6 py-32">
      <div className="max-w-7xl mx-auto w-full grid grid-cols-12 gap-6 items-center">
        <div className="col-span-12 md:col-span-6 text-left">
          <Reveal>
            <span className="text-xs uppercase tracking-[0.3em] text-accent">03 — Process</span>
            <h2 className="mt-4 text-5xl md:text-6xl font-bold leading-[1.02]">
              From precursor to perfection.
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className="p-6 rounded-xl border border-border/50 bg-card/40 backdrop-blur h-full">
                  <div className="text-sm text-primary font-mono">{s.n}</div>
                  <div className="mt-4 text-xl font-display">{s.t}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{s.d}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <div className="hidden md:block md:col-span-6" aria-hidden="true" />
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section id="contact" className="relative px-6 py-40">
      <div className="max-w-5xl mx-auto text-center">
        <Reveal>
          <h2 className="text-5xl md:text-8xl font-bold leading-[0.95]">
            Build with <span className="text-gradient">Tangent</span>.
          </h2>
          <p className="mt-8 text-lg text-muted-foreground max-w-xl mx-auto">
            Partner with us on the next generation of lightweight composites and
            specialty chemistry.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <a href="mailto:hello@tangent.materials" className="px-8 py-4 rounded-full bg-primary text-primary-foreground font-medium shadow-glow hover:scale-[1.02] transition">
              hello@tangent.materials
            </a>
            <a href="#top" className="px-8 py-4 rounded-full border border-border/60 hover:bg-secondary transition">
              Back to top
            </a>
          </div>
        </Reveal>
      </div>
      <div className="mt-32 pt-10 border-t border-border/40 max-w-7xl mx-auto flex flex-wrap justify-between text-sm text-muted-foreground">
        <div>© 2026 Tangent Advanced Materials</div>
        <div>Crafted with carbon, chemistry, and code.</div>
      </div>
    </section>
  );
}
