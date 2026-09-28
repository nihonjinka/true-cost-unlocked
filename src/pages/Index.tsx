import { StatusBar } from "@/components/landing/StatusBar";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { AuditTicker } from "@/components/landing/AuditTicker";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ArchitectureSection } from "@/components/landing/ArchitectureSection";
import { AIFeaturesSection } from "@/components/landing/AIFeaturesSection";
import { PathwaySection } from "@/components/landing/PathwaySection";
import { TestimonialSection } from "@/components/landing/TestimonialSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { Footer } from "@/components/landing/Footer";

export default function Index() {
  return (
    <div className="page-enter min-h-screen bg-background grid-bg scanline relative">
      <StatusBar />
      <div className="pt-10">
        <Navbar />
        <HeroSection />
        <AuditTicker />
        <ProblemSection />
        <ArchitectureSection />
        <AIFeaturesSection />
        <PathwaySection />
        <TestimonialSection />
        <PricingSection />
        <Footer />
      </div>
    </div>
  );
}
