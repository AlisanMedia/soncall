import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Only validate in browser/runtime, not during build
    if (typeof window !== 'undefined' && (!url || !key)) {
        throw new Error(
            '@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!\n' +
            'Check your Supabase project\'s API settings to find these values\n' +
            'https://supabase.com/dashboard/project/_/settings/api'
        )
    }

    // During build, if env vars are missing, use placeholder values to avoid errors
    // The actual client will work properly at runtime when env vars are available
    return createBrowserClient(
        url || 'https://placeholder.supabase.co',
        key || 'placeholder-key'
    )
}
