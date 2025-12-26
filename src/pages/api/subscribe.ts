import type { APIRoute } from 'astro';

export const prerender = false;

const getEnv = () => ({
    apiKey: import.meta.env.MAILCHIMP_API_KEY,
    audienceId: import.meta.env.MAILCHIMP_AUDIENCE_ID,
    serverPrefix: import.meta.env.MAILCHIMP_SERVER_PREFIX
});

const isValidEmail = (value: string | null) => Boolean(value && /\S+@\S+\.\S+/.test(value));

export const POST: APIRoute = async ({ request }) => {
    const env = getEnv();
    if (!env.apiKey || !env.audienceId || !env.serverPrefix) {
        return new Response(JSON.stringify({ error: 'Missing Mailchimp configuration' }), { status: 500 });
    }

    const contentType = request.headers.get('content-type') || '';
    let email: string | null = null;

    if (contentType.includes('application/json')) {
        const body = await request.json();
        email = body.email ?? null;
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await request.formData();
        email = (form.get('email') as string) ?? null;
    }

    if (!isValidEmail(email)) {
        return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400 });
    }

    try {
        const response = await fetch(
            `https://${env.serverPrefix}.api.mailchimp.com/3.0/lists/${env.audienceId}/members`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${Buffer.from(`anystring:${env.apiKey}`).toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email_address: email,
                    status: 'subscribed'
                })
            }
        );

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const message = data.detail || 'Unable to subscribe';
            return new Response(JSON.stringify({ error: message }), { status: response.status });
        }

        return new Response(JSON.stringify({ message: 'Subscribed' }), { status: 200 });
    } catch (error) {
        console.error('Mailchimp subscribe error', error);
        return new Response(JSON.stringify({ error: 'Subscription failed' }), { status: 500 });
    }
};

