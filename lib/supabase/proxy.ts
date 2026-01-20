import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    // Check for required environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Missing Supabase environment variables in proxy')
        // Allow the request through but log the error
        return NextResponse.next({
            request,
        })
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    try {
        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        // Set cookies on the request (for Server Components)
                        cookiesToSet.forEach(({ name, value }) =>
                            request.cookies.set(name, value)
                        )
                        // Create new response
                        supabaseResponse = NextResponse.next({
                            request,
                        })
                        // Set cookies on the response (for browser)
                        cookiesToSet.forEach(({ name, value, options }) =>
                            supabaseResponse.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        // Use getClaims() for better JWT validation (recommended by Supabase)
        const { data, error } = await supabase.auth.getClaims()

        // Redirect to login if no valid claims and not already on auth pages
        if (
            (!data || error) &&
            !request.nextUrl.pathname.startsWith('/login') &&
            !request.nextUrl.pathname.startsWith('/auth')
        ) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        return supabaseResponse
    } catch (error) {
        console.error('Proxy error:', error)
        // In case of error, allow request through to avoid blocking the entire app
        return NextResponse.next({
            request,
        })
    }
}
