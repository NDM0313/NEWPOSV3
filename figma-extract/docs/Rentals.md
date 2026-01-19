# Rentals Module Documentation

## Overview
The core module for the "Din Collection" bridal rental business. Manages bookings, returns, and availability calendars.

## Components
- `src/app/components/rentals/RentalDashboard.tsx`: Overview of rental status.
- `src/app/components/rentals/RentalOrdersList.tsx`: List of active and past rentals.
- `src/app/components/rentals/RentalCalendar.tsx`: Calendar view of bookings.
- `src/app/components/rentals/ReturnDressModal.tsx`: Processing returns and security deposits.

## Recent Changes
- General improvements to fit the dark mode theme.

## Tech Stack
- React
- Tailwind CSS
- FullCalendar (or similar calendar library)

## Cursor AI Instructions
When working on this module:
1. Ensure date handling is robust (checking for conflicts).
2. The calendar view must differeniate booking statuses clearly with colors suitable for dark mode.
3. Security deposit tracking must be precise.
