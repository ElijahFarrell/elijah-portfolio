"use client";

import { mailchimp } from '@/app/resources'
import { Button, Flex, Heading, Input, Text, Background } from '@/once-ui/components';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BeehiivClient } from '@beehiiv/sdk';


function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
    let timeout: ReturnType<typeof setTimeout>;
    return ((...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    }) as T;
}

type NewsletterProps = {
    display: boolean;
    title: string | JSX.Element;
    description: string | JSX.Element;
}

export const Mailchimp = (
    { newsletter }: { newsletter: NewsletterProps}
) => {
    const [email, setEmail] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [touched, setTouched] = useState<boolean>(false);

    const t = useTranslations();

    const validateEmail = (email: string): boolean => {
        if (email === '') {
            return true;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailPattern.test(email);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmail(value);

        if (!validateEmail(value)) {
            setError('Please enter a valid email address.');
        } else {
            setError('');
        }
    };
    const subscribe = async () => {
        if (!validateEmail(email)) {
            setError('Please enter a valid email address.');
            return;
        }

        try {
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to subscribe');
            }

            // Clear the input and show success
            setEmail('');
            setError('');
            alert('Successfully subscribed!'); // You might want to replace this with a better UI feedback
        } catch (err) {
            setError('Failed to subscribe. Please try again.');
            console.error('Subscription error:', err);
        }
    };

    const debouncedHandleChange = debounce(handleChange, 2000);

    const handleBlur = () => {
        setTouched(true);
        if (!validateEmail(email)) {
            setError('Please enter a valid email address.');
        }
    };

    return (
        <Flex
            style={{overflow: 'hidden'}}
            position="relative"
            fillWidth padding="xl" radius="l" marginBottom="m"
            direction="column" alignItems="center" align="center"
            background="surface" border="neutral-medium" borderStyle="solid-1">
            <Background
                position="absolute"
                mask={mailchimp.effects.mask as any}
                gradient={mailchimp.effects.gradient as any}
                dots={mailchimp.effects.dots as any}
                lines={mailchimp.effects.lines as any}/>
            <Heading style={{position: 'relative'}}
                marginBottom="s"
                variant="display-strong-xs">
                {newsletter.title}
            </Heading>
            <Text
                style={{
                    position: 'relative',
                    maxWidth: 'var(--responsive-width-xs)'
                }}
                wrap="balance"
                marginBottom="l"
                onBackground="neutral-medium">
                {newsletter.description}
            </Text>
            <Flex direction="row" gap="xs" style={{ width: 'var(--responsive-width-xs)' }}>
                <Input
                    id="email"
                    label="Enter Your Email"
                    value={email}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                />
                <Button
                    variant="primary"
                    size="l"
                    style={{ 
                        flex: 1,
                        height: '40px',  // Match input height
                        marginTop: '3px' // Align with input (accounting for label space)
                    }}
                    onClick={subscribe}
                >Subscribe</Button>
            </Flex>
        </Flex>
    )
}