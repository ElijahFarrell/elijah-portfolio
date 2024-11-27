import { InlineCode } from "@/once-ui/components";

const person = {
    firstName: 'Elijah',
    lastName:  'Farrell',
    get name() {
        return `${this.firstName} ${this.lastName}`;
    },
    role:      'Software Engineer',
    avatar:    '/images/avatar.jpg',
    location:  'America/New_York',        // Expecting the IANA time zone identifier, e.g., 'Europe/Vienna'
    languages: ['English']  // optional: Leave the array empty if you don't want to display languages
}

const newsletter = {
    display: true,
    title: <>Subscribe to {person.firstName}'s Newsletter</>,
    description: <>I occasionally write about technology and share thoughts on the intersection of business, faith and engineering.</>
}

const social = [
    // Links are automatically displayed.
    // Import new icons in /once-ui/icons.ts
    {
        name: 'GitHub',
        icon: 'github',
        link: 'https://github.com/ElijahFarrell',
    },
    {
        name: 'LinkedIn',
        icon: 'linkedin',
        link: 'https://www.linkedin.com/in/elijah-farrell/',
    },
    {
        name: 'X',
        icon: 'x',
        link: 'https://x.com/theElijahVFG',
    },
    {
        name: 'Email',
        icon: 'email',
        link: 'elijahf7302@gmail.com',
    },
]

const home = {
    label: 'Home',
    title: `${person.name}'s Portfolio`,
    description: `Portfolio website showcasing my work as a ${person.role}`,
    headline: <>Software engineer and builder</>,
    subline: <>I'm Elijah, a Software engineer at <InlineCode>Cyborg Mobile</InlineCode>, where I craft intuitive<br/> AI solutions and websites. After hours, I build my own projects.</>
}

const about = {
    label: 'About',
    title: 'About me',
    description: `Meet ${person.name}, ${person.role} from ${person.location}`,
    tableOfContent: {
        display: true,
        subItems: true
    },
    avatar: {
        display: true
    },
    calendar: {
        display: true,
        link: 'https://cal.com'
    },
    intro: {
        display: true,
        title: 'Introduction',
        description: <>Elijah is a New York-based software engineer with a passion for transforming complex challenges into simple, elegant technical solutions. His work spans AI, software development, and the convergence of business and technology.</>
    },
    
        work: {
          display: true,
          title: "Work Experience",
          experiences: [
            {
              company: "Cyborg Mobile",
              timeframe: "April 2024 – Present",
              role: "Software Engineer Intern",
              achievements: [
                "Enhanced application and user engagement by developing a Chatbot LLM with React, TypeScript, and Node.js, utilizing the OpenAI Assistants API.",
                "Scaled backend capabilities by designing RESTful APIs and integrating Firebase, facilitating data storage and retrieval for over 80 students.",
                "Collaborated closely with the head of engineering to follow best practices in software development, resulting in a high-quality application.",
                "Fine-tuned OpenAI's gpt-4o combined with RAG for improved results on a grant-writing assistant."
              ],
              images: []
            },
            {
              company: "Microsoft",
              timeframe: "May 2023 – August 2023",
              role: "Software Engineer Intern, IC3-AI",
              achievements: [
                "Improved bandwidth estimation model's real-time detection accuracy by 100%, optimizing diagnostics using C++.",
                "Reduced audio score estimation time by 68% in Microsoft Teams, impacting 1M+ calls, through the integration of a real-time audio MOS machine learning model with C++, Python.",
                "Collaborated with 5+ engineers from different teams to complete tasks in an effective manner."
              ],
              images: []
            },
            {
              company: "Soca Islands",
              timeframe: "March 2023 – April 2023",
              role: "Software Engineer (Freelance)",
              achievements: [
                "Streamlined checkout process on a client website, reducing checkout time by 33% through the implementation of filtering and recently viewed features using VueJS, TypeScript, HTML, and CSS.",
                "Enhanced product inventory management by developing a CRUD API for Firebase Firestore integration."
              ],
              images: []
            },
            {
              company: "Microsoft (Cyborg Mobile)",
              timeframe: "June 2022 – August 2022",
              role: "New Technologist Intern",
              achievements: [
                "Developed an MVP for a web app providing relatable online learning for underprivileged adults with a team of 4 other interns.",
                "Utilized React, Git, JavaScript, HTML, CSS to add and improve 3 frontend features.",
                "Integrated secure user authentication with Firebase Cloud."
              ],
              images: []
            }
          ]
        },
        studies: {
          display: true,
          title: "Education",
          institutions: [
            {
              name: "Stony Brook University",
              description: "Bachelor of Engineering in Computer Engineering. Relevant courses: Computer Vision, Operating Systems, Machine Learning Systems, Mobile Cloud Computing."
            },
            {
                name: "Certifications",
                description: "Enhance Text Generation with RAG, LangChain, and Vertex AI; Generative AI with Large Language Models."
            }
          ]
        },
        technical: {
          display: true,
          title: "Technical Skills",
          skills: [
            {
              title: "Programming Languages",
              description: "Python, C/C++, JavaScript, Java, HTML, CSS, TypeScript.",
              images: []
            },
            {
              title: "Databases/Cloud",
              description: "Azure, AWS, Google Cloud, Firebase, MongoDB, Jira, GitHub.",
              images: []
            },
            {
              title: "Frameworks",
              description: "Pandas, HuggingFace, LangChain, PyTorch, ONNX, React, Vue, Node.",
              images: []
            },
            
          ]
        }
      
      
}

const blog = {
    label: 'Blog',
    title: 'Writing about life and tech...',
    description: `Read what ${person.name} has been up to recently`,
    display: false
    // Create new blog posts by adding a new .mdx file to app/blog/posts
    // All posts will be listed on the /blog route
}

const work = {
    label: 'Work',
    title: 'My projects',
    description: `Dev projects by ${person.name}`
    // Create new project pages by adding a new .mdx file to app/blog/posts
    // All projects will be listed on the /home and /work routes
}

const gallery = {
    label: 'Gallery',
    title: 'My photo gallery',
    description: `A photo collection by ${person.name}`,
    // Images from https://pexels.com
    images: [
        { 
            src: '/images/gallery/img-01.jpg', 
            alt: 'image',
            orientation: 'vertical'
        },
        { 
            src: '/images/gallery/img-02.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-03.jpg', 
            alt: 'image',
            orientation: 'vertical'
        },
        { 
            src: '/images/gallery/img-04.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-05.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-06.jpg', 
            alt: 'image',
            orientation: 'vertical'
        },
        { 
            src: '/images/gallery/img-07.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-08.jpg', 
            alt: 'image',
            orientation: 'vertical'
        },
        { 
            src: '/images/gallery/img-09.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-10.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-11.jpg', 
            alt: 'image',
            orientation: 'vertical'
        },
        { 
            src: '/images/gallery/img-12.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-13.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
        { 
            src: '/images/gallery/img-14.jpg', 
            alt: 'image',
            orientation: 'horizontal'
        },
    ]
}

export { person, social, newsletter, home, about, blog, work, gallery };