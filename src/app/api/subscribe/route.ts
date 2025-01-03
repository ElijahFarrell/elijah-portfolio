import { BeehiivClient } from '@beehiiv/sdk';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        const client = new BeehiivClient({
            token: process.env.BEEHIIV_API_KEY! 
        });

        await client.subscriptions.create(
        process.env.NEXT_PUBLIC_BEEHIIV_PUBLICATION_ID!,
            {
                email: email,
                utmSource: 'website',
                utmMedium: 'organic'
            }
        );

        // if (response.data.status !== 'active') {
        //     throw new Error('Subscription failed');
        // }

        return NextResponse.json(
            { message: 'Successfully subscribed!' },
            { status: 200 }
        );

    } catch (error) {
        console.error('Subscription error:', error);
        return NextResponse.json(
            { error: 'Failed to subscribe' },
            { status: 500 }
        );
    }
} 