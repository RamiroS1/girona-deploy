import Link from "next/link";

interface BreadcrumbProps {
  pageName: string;
}

const Breadcrumb = ({ pageName }: BreadcrumbProps) => {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <h2 className="break-words text-xl font-bold leading-tight text-dark dark:text-white sm:text-2xl md:text-[26px] md:leading-[30px]">
        {pageName}
      </h2>

      <nav className="shrink-0 text-sm sm:text-base" aria-label="Migas de pan">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link className="font-medium text-body-color hover:text-primary dark:text-dark-6" href="/dashboard">
              Dashboard
            </Link>
          </li>
          <li className="text-body-color" aria-hidden>
            /
          </li>
          <li className="font-medium text-primary">{pageName}</li>
        </ol>
      </nav>
    </div>
  );
};

export default Breadcrumb;
