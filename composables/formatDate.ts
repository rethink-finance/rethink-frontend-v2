/**
 * Formats a JavaScript Date object as "24 Jul 23" (day of the month, abbreviated month name, and last two digits of the year).
 *
 * @param {Date} date - The Date object to be formatted.
 * @returns {string} The formatted date string.
 */
export const formatDate = (date: Date) => {
  if (!date) return "";
  const day = date.getDate().toString().padStart(2, "0"); // Day of the month with leading zero
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = monthNames[date.getMonth()]; // Abbreviated month name
  const year = date.getFullYear().toString().slice(-2); // Last two digits of the year

  return `${day} ${month} ${year}`;
}
