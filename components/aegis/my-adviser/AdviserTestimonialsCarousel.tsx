"use client";

import { useCallback, useRef } from "react";

import type { PublicTestimonial } from "@/lib/aegis/myAdviser";

interface AdviserTestimonialsCarouselProps {
  testimonials: PublicTestimonial[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={`text-sm ${
            index < rating ? "text-[#D1A866]" : "text-[#F3F1EA]/20"
          }`}
          aria-hidden
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function AdviserTestimonialsCarousel({
  testimonials,
}: AdviserTestimonialsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByCard = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;

    const cardWidth = track.clientWidth * 0.85;
    track.scrollBy({ left: direction * cardWidth, behavior: "smooth" });
  }, []);

  if (testimonials.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          Approved client testimonials will appear here once available.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-3 hidden items-center justify-end gap-2 sm:flex">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          className="rounded-sm border border-[#D1A866]/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866]/80 transition-colors hover:bg-[#D1A866]/10"
          aria-label="Previous testimonial"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          className="rounded-sm border border-[#D1A866]/25 px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#D1A866]/80 transition-colors hover:bg-[#D1A866]/10"
          aria-label="Next testimonial"
        >
          Next →
        </button>
      </div>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {testimonials.map((item) => (
          <article
            key={item.id}
            className="w-[min(85%,18rem)] shrink-0 snap-start rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 p-5"
          >
            <StarRating rating={item.ratingOverall} />
            <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/75">
              &ldquo;{item.testimonialText}&rdquo;
            </p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/35">
              {item.displayLabel}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
