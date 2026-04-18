"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

type PropsType = {
  data: {
    received: { x: unknown; y: number }[];
    due: { x: unknown; y: number }[];
  };
};

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export function PaymentsOverviewChart({ data }: PropsType) {
  const isMobile = useIsMobile();
  const pointCount = Math.max(data.received.length, data.due.length);
  const labelStep = pointCount > 24 ? 4 : pointCount > 14 ? 2 : 1;
  const formatCop = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value || 0);

  const options: ApexOptions = {
    legend: {
      show: false,
    },
    colors: ["#00d492", "#ff2056"],
    chart: {
      height: 310,
      type: "area",
      toolbar: {
        show: false,
      },
      fontFamily: "inherit",
    },
    fill: {
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    responsive: [
      {
        breakpoint: 1024,
        options: {
          chart: {
            height: 300,
          },
        },
      },
      {
        breakpoint: 1366,
        options: {
          chart: {
            height: 320,
          },
        },
      },
    ],
    stroke: {
      curve: "smooth",
      width: isMobile ? 2 : 3,
    },
    grid: {
      strokeDashArray: 5,
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      marker: {
        show: true,
      },
      y: {
        formatter: (value: number) => formatCop(value),
      },
    },
    xaxis: {
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      title: {
        text: "Fecha",
      },
      labels: {
        rotate: -50,
        hideOverlappingLabels: true,
        showDuplicates: false,
        offsetY: 6,
        formatter: (value: string, _timestamp?: number, opts?: { i?: number }) => {
          const index = opts?.i ?? 0;
          return index % labelStep === 0 ? value : "";
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => formatCop(value),
      },
      title: {
        text: "Valor (COP)",
      },
    },
  };

  return (
    <div className="-ml-4 -mr-5 h-[310px]">
      <Chart
        options={options}
        series={[
          {
            name: "Ingresos",
            data: data.received,
          },
          {
            name: "Egresos",
            data: data.due,
          },
        ]}
        type="area"
        height={310}
      />
    </div>
  );
}
