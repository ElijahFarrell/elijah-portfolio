import { Flex, Heading, Text, Button, SmartLink } from '@/once-ui/components';
import { baseURL, renderContent } from '@/app/resources';
import { getTranslations, unstable_setRequestLocale } from 'next-intl/server';
import { useTranslations } from 'next-intl';

export async function generateMetadata(
    {params: {locale}}: { params: { locale: string }}
) {
    const t = await getTranslations();
    const title = "Services";
    const description = "Professional services offered including AI Automation and Full-Stack Development";
    const ogImage = `https://${baseURL}/og?title=${encodeURIComponent(title)}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            url: `https://${baseURL}/${locale}/services`,
            images: [
                {
                    url: ogImage,
                    alt: title,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
    };
}

export default function Services(
    { params: {locale}}: { params: { locale: string }}
) {
    unstable_setRequestLocale(locale);
    
    return (
        <Flex
            fillWidth maxWidth="m"
            direction="column"
            gap="xl">
            
            <Heading
                variant="display-strong-s"
                marginBottom="l">
                Services
            </Heading>

            <Flex
                fillWidth
                gap="l"
                wrap
                justifyContent="center">
                
                {/* AI Automation Card */}
                <Flex
                    direction="column"
                    gap="m"
                    padding="xl"
                    style={{
                        flex: '1 1 400px',
                        maxWidth: '500px',
                        border: '1px solid var(--neutral-alpha-weak)',
                        borderRadius: 'var(--radius-l)',
                        background: 'var(--neutral-surface-default)'
                    }}>
                    <Heading variant="heading-strong-l">AI Automation</Heading>
                    <Text variant="body-default-m" onBackground="neutral-weak">
                        Leverage cutting-edge AI technologies to automate and optimize your business processes. 
                        Specializing in custom AI solutions, chatbots, and intelligent automation systems.
                    </Text>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <Text as="li" variant="body-default-m" marginY="8">• Custom AI Agent Development</Text>
                        <Text as="li" variant="body-default-m" marginY="8">• LLM Integration & Fine-tuning</Text>
                        <Text as="li" variant="body-default-m" marginY="8">• Process Automation Solutions</Text>
                    </ul>
                </Flex>

                {/* Full-Stack Development Card */}
                <Flex
                    direction="column"
                    gap="m"
                    padding="xl"
                    style={{
                        flex: '1 1 400px',
                        maxWidth: '500px',
                        border: '1px solid var(--neutral-alpha-weak)',
                        borderRadius: 'var(--radius-l)',
                        background: 'var(--neutral-surface-default)'
                    }}>
                    <Heading variant="heading-strong-l">Full-Stack Development</Heading>
                    <Text variant="body-default-m" onBackground="neutral-weak">
                        End-to-end web development services creating robust, scalable applications. 
                        From responsive frontends to powerful backend systems.
                    </Text>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        <Text as="li" variant="body-default-m" marginY="8">• Custom Web Applications</Text>
                        <Text as="li" variant="body-default-m" marginY="8">• API Development & Integration</Text>
                        <Text as="li" variant="body-default-m" marginY="8">• Database Design & Implementation</Text>
                    </ul>
                </Flex>
            </Flex>

            {/* CTA Section */}
            <Flex
                direction="column"
                alignItems="center"
                gap="m"
                marginTop='m'>
                <Text
                    variant="heading-strong-m"
                >
                    Ready to start your next project?
                </Text>
                <Button
                    href="https://forms.gle/v2KyyeorXu3Jkhi59"
                    size="l"
                    variant="primary">
                    Get in Touch
                </Button>
            </Flex>
        </Flex>
    );
}
