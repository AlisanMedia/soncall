import { GlowingEffectDemo } from "@/components/ui/glowing-effect-demo";

export default function GlowingDemoPage() {
    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-12 text-center">
                    <h1 className="text-5xl font-black gradient-text-vivid mb-4">
                        GlowingEffect Demo
                    </h1>
                    <p className="text-zinc-400 text-lg">
                        Mouse ile kartların üzerine gelerek efekti görün
                    </p>
                </div>

                <GlowingEffectDemo />
            </div>
        </div>
    );
}
