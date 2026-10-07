import { AiAssistant } from "@/components/home/AiAssistant";
import { DemoCta } from "@/components/home/DemoCta";
import { Features } from "@/components/home/Features";
import { Hero } from "@/components/home/Hero";
import { Method } from "@/components/home/Method";
import { PersonalTaskDemo } from "@/components/home/PersonalTaskDemo";
import { Pricing } from "@/components/home/Pricing";
import { Specialties } from "@/components/home/Specialties";
import { WhyIBeam } from "@/components/home/WhyIBeam";
import { Container } from "@/components/layout/Container";

// Начална страница – подредбата следва прототипа на дизайна.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Container>
        <WhyIBeam />
        <Features />
        <Method />
        <Specialties />
        <PersonalTaskDemo />
        <AiAssistant />
        <Pricing />
        <DemoCta />
      </Container>
    </>
  );
}
