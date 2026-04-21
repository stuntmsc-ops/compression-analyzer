import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LandingMarketing from "@/components/LandingMarketing";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Header />
      <main className="flex-1">
        <LandingMarketing />
      </main>
      <Footer />
    </div>
  );
}
