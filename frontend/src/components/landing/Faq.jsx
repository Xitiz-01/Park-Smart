import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Answers describe what the product does today, nothing more.
const faqs = [
  {
    q: 'Do I pay in the app?',
    a: 'Not yet. The hourly rate is fixed when you reserve and your booking shows the estimate, but payment isn’t taken in the app today.',
  },
  {
    q: 'How is booking an EV different?',
    a: 'Cars and motorcycles reserve a space from a location’s capacity. Electric vehicles reserve one exact charging bay, so you can see its power and connector before you book.',
  },
  {
    q: 'How up to date is availability?',
    a: 'Counts and bay states change as bookings are made, cancelled, checked in and checked out, and pages you have open update on their own.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. You can cancel an upcoming booking from My bookings, and the space is released straight away.',
  },
  {
    q: 'Where can I use ParkSmart?',
    a: 'Wherever operators have published locations. Address search currently covers India.',
  },
  {
    q: 'How do I list my parking?',
    a: 'Create an account and apply as an operator. Once an admin approves you, add your locations; each one goes live after you and the site are verified.',
  },
];

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 border-t bg-surface-raised">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-28">
        <div>
          <h2 id="faq-title" className="font-display text-display-xl font-semibold text-balance">Questions, answered.</h2>
          <p className="mt-4 max-w-md text-lg text-text-muted">The short version of how ParkSmart works today.</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="py-4 text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="pb-4 text-base text-pretty text-text-muted">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
