import { Link } from 'wouter';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="enter flex min-h-[60dvh] w-full items-center justify-center py-10">
      <section className="panel w-full max-w-md rounded-2xl p-6 text-center md:p-8">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#c4ad72]/25 bg-[#c4ad72]/10 text-[#d3be84]">
          <Compass size={22} />
        </div>
        <h1 className="page-title m-0 text-3xl text-[#efe7d7]">
          Раздел не найден
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#9b9c95]">
          Такой страницы в журнале нет. Можно вернуться к персонажу и продолжить работу.
        </p>
        <Link href="/" className="btn-primary mt-5">
          Вернуться к персонажу
        </Link>
      </section>
    </div>
  );
}
