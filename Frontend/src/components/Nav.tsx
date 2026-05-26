import { motion } from "framer-motion";

export function Nav() {
  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/40 border-b border-border/40"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <a href="#top" className="font-display text-lg tracking-tight">
          <span className="text-gradient font-bold">TANGENT</span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          <a href="#carbon" className="hover:text-foreground transition">Carbon Fiber</a>
          <a href="#chemicals" className="hover:text-foreground transition">Chemicals</a>
          <a href="#process" className="hover:text-foreground transition">Process</a>
          <a href="#contact" className="hover:text-foreground transition">Contact</a>
        </nav>
        <a href="#contact" className="text-sm px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition">
          Request sample
        </a>
      </div>
    </motion.header>
  );
}
