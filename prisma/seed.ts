// Elévate LMS — Seed Script
// Populates the database with realistic test data.
// Safe to run multiple times: clears existing data first, then upserts users.
// Run with: bun run prisma/seed.ts

import { PrismaClient, Role, CourseLevel, CourseStatus, LessonType, EnrollmentStatus, SubmissionStatus, NotificationType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ─── helpers ──────────────────────────────────────────────────────────

function hash(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

function ts(daysAgo = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d
}

function future(days = 7): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

const DELIM = '─'.repeat(60)

// ─── main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 Elévate LMS Seed Script')
  console.log(DELIM)

  const counts: Record<string, number> = {}

  // ── 0. Clear existing data (reverse dependency order) ─────────────
  console.log('\n🗑️  Clearing existing data …')
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.submission.deleteMany(),
    db.notification.deleteMany(),
    db.announcement.deleteMany(),
    db.assignment.deleteMany(),
    db.enrollment.deleteMany(),
    db.lesson.deleteMany(),
    db.module.deleteMany(),
    db.course.deleteMany(),
    db.user.deleteMany(),
  ])
  console.log('   ✔ All tables cleared\n')

  // ── 1. Users ──────────────────────────────────────────────────────
  console.log('👤 Creating users …')
  const usersData = [
    { email: 'admin@elevate-lms.com', password: 'Admin123456', role: Role.SUPER_ADMIN, firstName: 'Admin', lastName: 'System' },
    { email: 'prof1@elevate-lms.com', password: 'Prof123456', role: Role.PROFESSOR, firstName: 'María', lastName: 'García' },
    { email: 'prof2@elevate-lms.com', password: 'Prof123456', role: Role.PROFESSOR, firstName: 'Carlos', lastName: 'Rodríguez' },
    { email: 'student1@elevate-lms.com', password: 'Stud123456', role: Role.STUDENT, firstName: 'Ana', lastName: 'Martínez' },
    { email: 'student2@elevate-lms.com', password: 'Stud123456', role: Role.STUDENT, firstName: 'Juan', lastName: 'López' },
    { email: 'student3@elevate-lms.com', password: 'Stud123456', role: Role.STUDENT, firstName: 'Laura', lastName: 'Sánchez' },
  ] as const

  const users: Record<string, { id: string; email: string }> = {}
  for (const u of usersData) {
    const created = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash: await hash(u.password),
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
        emailVerified: true,
        lastLoginAt: ts(Math.floor(Math.random() * 3)),
      },
    })
    users[u.email] = created
    console.log(`   ✔ ${created.firstName} ${created.lastName} (${created.role}) → ${created.email}`)
  }
  counts.users = usersData.length

  const admin   = users['admin@elevate-lms.com']
  const prof1   = users['prof1@elevate-lms.com']
  const prof2   = users['prof2@elevate-lms.com']
  const student1 = users['student1@elevate-lms.com']
  const student2 = users['student2@elevate-lms.com']
  const student3 = users['student3@elevate-lms.com']

  // ── 2. Courses ───────────────────────────────────────────────────
  console.log('\n📚 Creating courses …')
  const coursesData = [
    {
      title: 'Introducción a la Programación',
      description: 'Aprende los fundamentos de la programación desde cero. Cubre variables, tipos de datos, estructuras de control, funciones y una introducción a la programación orientada a objetos.',
      instructorId: prof1.id,
      status: CourseStatus.PUBLISHED,
      level: CourseLevel.BEGINNER,
      category: 'Tecnología',
      maxStudents: 50,
    },
    {
      title: 'Diseño UX/UI Fundamentals',
      description: 'Dominios los principios del diseño centrado en el usuario. Aprende investigación de usuarios, wireframing, prototipado, testing de usabilidad y herramientas de diseño profesional.',
      instructorId: prof1.id,
      status: CourseStatus.PUBLISHED,
      level: CourseLevel.INTERMEDIATE,
      category: 'Diseño',
      maxStudents: 30,
    },
    {
      title: 'Gestión de Proyectos',
      description: 'Metodologías ágiles, gestión de equipos, planificación de sprints y herramientas para el éxito en la gestión de proyectos tecnológicos y de negocio.',
      instructorId: prof2.id,
      status: CourseStatus.PUBLISHED,
      level: CourseLevel.BEGINNER,
      category: 'Negocios',
      maxStudents: 40,
    },
    {
      title: 'Bases de Datos Avanzadas',
      description: 'Optimización de queries, indexación, replicación, particionamiento, bases de datos NoSQL y arquitecturas de alta disponibilidad.',
      instructorId: prof2.id,
      status: CourseStatus.DRAFT,
      level: CourseLevel.ADVANCED,
      category: 'Tecnología',
      maxStudents: 25,
    },
  ] as const

  const courses: Record<string, { id: string; title: string; status: CourseStatus; instructorId: string }> = {}
  for (const c of coursesData) {
    const created = await db.course.create({ data: { ...c } })
    courses[created.title] = created
    console.log(`   ✔ "${created.title}" (${created.status}, ${created.level}, ${created.category})`)
  }
  counts.courses = coursesData.length

  // convenience refs
  const course1 = courses['Introducción a la Programación']        // published, prof1
  const course2 = courses['Diseño UX/UI Fundamentals']            // published, prof1
  const course3 = courses['Gestión de Proyectos']                  // published, prof2
  const course4 = courses['Bases de Datos Avanzadas']             // draft, prof2

  const publishedCourses = [course1, course2, course3]

  // ── 3. Modules & Lessons for each published course ────────────────
  console.log('\n📦 Creating modules & lessons …')

  // Type for module definitions
  type ModuleDef = {
    moduleTitle: string
    lessons: { title: string; type: LessonType; content: string; durationMinutes?: number }[]
  }

  const modulesAndLessons: ModuleDef[][] = [
    // Course 1 — Introducción a la Programación
    [
      {
        moduleTitle: 'Fundamentos de Programación',
        lessons: [
          { title: '¿Qué es la Programación?', type: LessonType.TEXT, content: 'La programación es el proceso de crear instrucciones que una computadora puede ejecutar. Aprenderemos sobre algoritmos, lógica computacional y la historia de los lenguajes de programación.', durationMinutes: 15 },
          { title: 'Variables y Tipos de Datos', type: LessonType.TEXT, content: 'Las variables son contenedores para almacenar datos. Exploraremos tipos primitivos: enteros, flotantes, cadenas, booleanos y cómo declararlos en diferentes lenguajes.', durationMinutes: 25 },
          { title: 'Quiz: Fundamentos', type: LessonType.QUIZ, content: JSON.stringify({ questions: [{ q: '¿Qué es una variable?', options: ['Un contenedor de datos', 'Un tipo de bucle', 'Un operador', 'Una función'], correct: 0 }, { q: '¿Cuál es un tipo de dato primitivo?', options: ['Array', 'Objeto', 'Booleano', 'Clase'], correct: 2 }] }) },
        ],
      },
      {
        moduleTitle: 'Estructuras de Control',
        lessons: [
          { title: 'Condicionales (if/else)', type: LessonType.TEXT, content: 'Las estructuras condicionales permiten tomar decisiones en el código. Aprenderemos sobre if, else if, else y operadores de comparación y lógicos.', durationMinutes: 20 },
          { title: 'Video: Ejemplos Prácticos de Condicionales', type: LessonType.VIDEO, content: 'https://example.com/videos/conditionals-intro', durationMinutes: 18 },
          { title: 'Bucles (for, while)', type: LessonType.TEXT, content: 'Los bucles permiten repetir bloques de código. Veremos bucles for, while, do-while y cuándo usar cada uno.', durationMinutes: 30 },
          { title: 'Quiz: Estructuras de Control', type: LessonType.QUIZ, content: JSON.stringify({ questions: [{ q: '¿Qué bucle se usa cuando se conoce el número de iteraciones?', options: ['while', 'do-while', 'for', 'switch'], correct: 2 }] }) },
        ],
      },
      {
        moduleTitle: 'Funciones',
        lessons: [
          { title: 'Definiendo Funciones', type: LessonType.TEXT, content: 'Las funciones son bloques de código reutilizables. Aprenderemos parámetros, valores de retorno, alcance de variables y buenas prácticas de nomenclatura.', durationMinutes: 25 },
          { title: 'Video: Funciones en Acción', type: LessonType.VIDEO, content: 'https://example.com/videos/functions-demo', durationMinutes: 22 },
          { title: 'Ámbito y Closures', type: LessonType.TEXT, content: 'Entender el ámbito (scope) es fundamental. Cubriremos ámbito global vs local, closures y su importancia en la programación moderna.', durationMinutes: 20 },
        ],
      },
      {
        moduleTitle: 'Introducción a POO',
        lessons: [
          { title: 'Clases y Objetos', type: LessonType.TEXT, content: 'La programación orientada a objetos (POO) organiza el código alrededor de entidades. Aprenderemos sobre clases, objetos, atributos y métodos.', durationMinutes: 30 },
          { title: 'Herencia y Polimorfismo', type: LessonType.TEXT, content: 'La herencia permite crear clases basadas en otras existentes. El polimorfismo permite que un mismo método se comporte de forma diferente según el objeto.', durationMinutes: 25 },
          { title: 'Quiz: POO Básica', type: LessonType.QUIZ, content: JSON.stringify({ questions: [{ q: '¿Qué es una clase?', options: ['Una instancia de un objeto', 'Una plantilla para crear objetos', 'Un tipo de variable', 'Un operador lógico'], correct: 1 }] }) },
        ],
      },
    ],
    // Course 2 — Diseño UX/UI Fundamentals
    [
      {
        moduleTitle: 'Fundamentos de UX',
        lessons: [
          { title: '¿Qué es UX Design?', type: LessonType.TEXT, content: 'UX (User Experience) se enfoca en crear productos que proporcionen experiencias significativas y relevantes a los usuarios. Aprenderemos los principios fundamentales de Don Norman y Jesse James Garrett.', durationMinutes: 20 },
          { title: 'Video: Historia del UX Design', type: LessonType.VIDEO, content: 'https://example.com/videos/ux-history', durationMinutes: 15 },
          { title: 'Investigación de Usuarios', type: LessonType.TEXT, content: 'Métodos de investigación: entrevistas, encuestas, observación contextual, análisis de tareas y creation de personas. Aprenderemos a descubrir las necesidades reales de los usuarios.', durationMinutes: 30 },
        ],
      },
      {
        moduleTitle: 'Wireframing y Prototipado',
        lessons: [
          { title: 'Wireframes de baja y alta fidelidad', type: LessonType.TEXT, content: 'Los wireframes son el esqueleto visual de una interfaz. Veremos la diferencia entre wireframes de baja y alta fidelidad, herramientas como Figma y Sketch, y mejores prácticas.', durationMinutes: 25 },
          { title: 'Video: Prototipado en Figma', type: LessonType.VIDEO, content: 'https://example.com/videos/figma-prototyping', durationMinutes: 28 },
          { title: 'Prototipos interactivos', type: LessonType.TEXT, content: 'Los prototipos interactivos nos permiten simular la experiencia real del usuario. Crearemos prototipos navegables con transiciones y animaciones realistas.', durationMinutes: 20 },
          { title: 'Quiz: Wireframing', type: LessonType.QUIZ, content: JSON.stringify({ questions: [{ q: '¿Cuál es la diferencia entre wireframe de baja y alta fidelidad?', options: ['El color', 'El nivel de detalle', 'El tamaño', 'La herramienta'], correct: 1 }] }) },
        ],
      },
      {
        moduleTitle: 'Principios de UI Visual',
        lessons: [
          { title: 'Jerarquía Visual y Tipografía', type: LessonType.TEXT, content: 'La jerarquía visual guía la atención del usuario. Aprenderemos sobre peso visual, contraste, espaciado y cómo la tipografía afecta la legibilidad y la percepción.', durationMinutes: 25 },
          { title: 'Color y Accesibilidad', type: LessonType.TEXT, content: 'El uso del color es crucial en UI. Cubriremos teoría del color, paletas armónicas, contraste WCAG y cómo diseñar para usuarios con daltonismo.', durationMinutes: 20 },
          { title: 'Video: Diseño de Componentes', type: LessonType.VIDEO, content: 'https://example.com/videos/ui-components', durationMinutes: 22 },
        ],
      },
    ],
    // Course 3 — Gestión de Proyectos
    [
      {
        moduleTitle: 'Fundamentos de Gestión de Proyectos',
        lessons: [
          { title: 'El Rol del Project Manager', type: LessonType.TEXT, content: 'El gestor de proyectos es el puente entre el equipo, los stakeholders y los objetivos del negocio. Veremos habilidades clave, frameworks y el ciclo de vida de un proyecto.', durationMinutes: 20 },
          { title: 'Video: Introducción a PMI y PMBOK', type: LessonType.VIDEO, content: 'https://example.com/videos/pmi-pmbok', durationMinutes: 18 },
          { title: 'Quiz: Fundamentos PM', type: LessonType.QUIZ, content: JSON.stringify({ questions: [{ q: '¿Qué es el PMBOK?', options: ['Un software', 'Un estándar de gestión de proyectos', 'Un methodology ágil', 'Una herramienta'], correct: 1 }] }) },
        ],
      },
      {
        moduleTitle: 'Metodologías Ágiles',
        lessons: [
          { title: 'Scrum Framework', type: LessonType.TEXT, content: 'Scrum es el framework ágil más utilizado. Aprenderemos sobre roles (Product Owner, Scrum Master, Team), ceremonias (Sprint, Daily, Review, Retrospective) y artefactos (Backlog, Sprint Backlog, Burndown).', durationMinutes: 30 },
          { title: 'Kanban vs Scrum', type: LessonType.TEXT, content: 'Comparación entre Kanban y Scrum: cuándo usar cada uno, ventajas y desventajas, y cómo combinar elementos de ambos (Scrumban).', durationMinutes: 20 },
          { title: 'Video: Planificación de un Sprint', type: LessonType.VIDEO, content: 'https://example.com/videos/sprint-planning', durationMinutes: 25 },
          { title: 'Historias de Usuario y Story Points', type: LessonType.TEXT, content: 'Cómo escribir historias de usuario efectivas usando el formato "Como [rol], quiero [acción], para [beneficio]". Estimación con Planning Poker y story points.', durationMinutes: 25 },
        ],
      },
      {
        moduleTitle: 'Herramientas y Comunicación',
        lessons: [
          { title: 'Jira, Trello y Asana', type: LessonType.TEXT, content: 'Comparación de herramientas de gestión de proyectos: Jira para equipos de desarrollo, Trello para gestión visual, Asana para equipos cross-funcionales. Configuración y mejores prácticas.', durationMinutes: 25 },
          { title: 'Gestión de Stakeholders', type: LessonType.TEXT, content: 'Identificar, analizar y gestionar a los stakeholders es esencial. Aprenderemos la matriz de poder/interés, comunicación efectiva y gestión de expectativas.', durationMinutes: 20 },
        ],
      },
    ],
  ]

  const moduleIds: Record<string, string> = {}   // courseTitle-index → moduleId
  let totalModules = 0
  let totalLessons = 0

  for (let ci = 0; ci < publishedCourses.length; ci++) {
    const course = publishedCourses[ci]
    const courseTitle = course.title
    const moduleDefs = modulesAndLessons[ci]
    console.log(`   📚 "${courseTitle}":`)

    for (let mi = 0; mi < moduleDefs.length; mi++) {
      const mod = moduleDefs[mi]
      const createdModule = await db.module.create({
        data: {
          title: mod.moduleTitle,
          description: `Módulo ${mi + 1} del curso ${courseTitle}`,
          courseId: course.id,
          order: mi + 1,
        },
      })
      moduleIds[`${courseTitle}-${mi}`] = createdModule.id
      totalModules++
      console.log(`     Module ${mi + 1}: "${createdModule.title}"`)

      for (let li = 0; li < mod.lessons.length; li++) {
        const lesson = mod.lessons[li]
        await db.lesson.create({
          data: {
            title: lesson.title,
            content: lesson.content,
            type: lesson.type,
            moduleId: createdModule.id,
            order: li + 1,
            durationMinutes: lesson.durationMinutes,
          },
        })
        totalLessons++
      }
    }
  }
  counts.modules = totalModules
  counts.lessons = totalLessons

  // ── 4. Assignments (1-2 per published course) ─────────────────────
  console.log('\n📝 Creating assignments …')
  const assignmentsData: { title: string; description: string; courseId: string; moduleId: string | null; dueDate: Date; maxScore: number }[] = [
    { title: 'Primer Programa: Hola Mundo', description: 'Escribe tu primer programa que muestre "Hola Mundo" por pantalla. Luego, crea un programa que pida el nombre del usuario y lo salude personalmente.', courseId: course1.id, moduleId: moduleIds['Introducción a la Programación-0'], dueDate: future(14), maxScore: 100 },
    { title: 'Calculadora Básica', description: 'Implementa una calculadora que soporte suma, resta, multiplicación y división usando funciones. Debe manejar errores de división por cero.', courseId: course1.id, moduleId: moduleIds['Introducción a la Programación-2'], dueDate: future(21), maxScore: 100 },
    { title: 'Rediseño de App Móvil', description: 'Elige una app móvil existente y rediseña su flujo principal. Entrega wireframes de baja fidelidad + un prototipo interactivo de alta fidelidad en Figma.', courseId: course2.id, moduleId: moduleIds['Diseño UX/UI Fundamentals-1'], dueDate: future(10), maxScore: 100 },
    { title: 'Plan de Proyecto Sprint', description: 'Crea un plan de proyecto completo para un sprint de 2 semanas usando Scrum. Incluye: Product Backlog priorizado, Sprint Backlog, Daily Scrum notes, y métricas de seguimiento.', courseId: course3.id, moduleId: moduleIds['Gestión de Proyectos-1'], dueDate: future(7), maxScore: 100 },
    { title: 'Evaluación de Herramientas PM', description: 'Compara tres herramientas de gestión de proyectos (Jira, Trello, Asana). Para cada una, describe: ventajas, desventajas, casos de uso ideales y costo. Presenta en formato de tabla comparativa.', courseId: course3.id, moduleId: moduleIds['Gestión de Proyectos-2'], dueDate: future(18), maxScore: 80 },
  ]

  const assignments: { id: string; courseId: string }[] = []
  for (const a of assignmentsData) {
    const created = await db.assignment.create({ data: a })
    assignments.push(created)
    const courseName = publishedCourses.find(c => c.id === created.courseId)?.title ?? 'Unknown'
    console.log(`   ✔ "${created.title}" → ${courseName} (due ${created.dueDate?.toISOString().split('T')[0]})`)
  }
  counts.assignments = assignments.length

  // ── 5. Enrollments ────────────────────────────────────────────────
  console.log('\n🎓 Creating enrollments …')
  const enrollmentsData: { userId: string; courseId: string; progress: number }[] = [
    // student1: all 3 published
    { userId: student1.id, courseId: course1.id, progress: 65 },
    { userId: student1.id, courseId: course2.id, progress: 30 },
    { userId: student1.id, courseId: course3.id, progress: 10 },
    // student2: courses 1 & 2
    { userId: student2.id, courseId: course1.id, progress: 45 },
    { userId: student2.id, courseId: course2.id, progress: 80 },
    // student3: course 1 only
    { userId: student3.id, courseId: course1.id, progress: 20 },
  ]

  for (const e of enrollmentsData) {
    await db.enrollment.create({
      data: {
        userId: e.userId,
        courseId: e.courseId,
        status: EnrollmentStatus.ACTIVE,
        progress: e.progress,
      },
    })
    const user = Object.values(users).find(u => u.id === e.userId)
    const course = publishedCourses.find(c => c.id === e.courseId)
    console.log(`   ✔ ${user?.email} → "${course?.title}" (${e.progress}% progress)`)
  }
  counts.enrollments = enrollmentsData.length

  // Update course enrollCount
  for (const course of publishedCourses) {
    const count = enrollmentsData.filter(e => e.courseId === course.id).length
    await db.course.update({ where: { id: course.id }, data: { enrollCount: count } })
  }

  // ── 6. Submissions ────────────────────────────────────────────────
  console.log('\n📋 Creating submissions …')
  const submissionsData: { assignmentId: string; studentId: string; content: string; status: SubmissionStatus; score: number | null; feedback: string | null; daysAgo: number }[] = [
    // student1 — submitted & graded for course1 assignment1
    { assignmentId: assignments[0].id, studentId: student1.id, content: '```\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("Hola Mundo!");\n    Scanner sc = new Scanner(System.in);\n    System.out.print("Tu nombre: ");\n    String nombre = sc.nextLine();\n    System.out.println("¡Hola, " + nombre + "!");\n  }\n}\n```', status: SubmissionStatus.GRADED, score: 92, feedback: 'Excelente trabajo. El código compila correctamente y maneja bien la entrada del usuario. Sugerencia: agrega manejo de excepciones.', daysAgo: 5 },
    // student1 — submitted (pending) for course1 assignment2
    { assignmentId: assignments[1].id, studentId: student1.id, content: 'Implementé las 4 operaciones básicas con validación de entrada. La división por cero lanza una excepción personalizada con mensaje descriptivo.', status: SubmissionStatus.SUBMITTED, score: null, feedback: null, daysAgo: 1 },
    // student1 — submitted & graded for course2 assignment
    { assignmentId: assignments[2].id, studentId: student1.id, content: 'Rediseño completo de la app de delivery "PedidosYa". Incluye wireframes de baja fidelidad (6 pantallas) y prototipo interactivo en Figma. Enfoque en simplificar el flujo de pedido.', status: SubmissionStatus.GRADED, score: 88, feedback: 'Buen análisis del problema. Los wireframes son claros. El prototipo está bien logrado. Mejora la jerarquía visual en la pantalla de confirmación.', daysAgo: 8 },
    // student2 — submitted & graded for course1 assignment1
    { assignmentId: assignments[0].id, studentId: student2.id, content: '```\nprint("Hola Mundo")\nnombre = input("¿Cuál es tu nombre? ")\nprint(f"¡Hola, {nombre}!")\n```', status: SubmissionStatus.GRADED, score: 85, feedback: 'Buena solución en Python. Funciona correctamente. Para mejorar, considera agregar validación de entrada vacía.', daysAgo: 6 },
    // student2 — submitted (pending) for course2 assignment
    { assignmentId: assignments[2].id, studentId: student2.id, content: 'Rediseño de la app bancaria "MercadoPago". Enfoque en la pantalla de transferencias: simplificación del formulario y confirmación con biometría.', status: SubmissionStatus.SUBMITTED, score: null, feedback: null, daysAgo: 2 },
    // student3 — submitted (pending) for course1 assignment1
    { assignmentId: assignments[0].id, studentId: student3.id, content: 'Mi primer programa en JavaScript que usa prompt() y alert() para saludar al usuario.', status: SubmissionStatus.SUBMITTED, score: null, feedback: null, daysAgo: 3 },
    // student1 — submitted & graded for course3 assignment1
    { assignmentId: assignments[3].id, studentId: student1.id, content: 'Plan de Sprint completo para un proyecto de e-commerce. Backlog con 24 historias de usuario priorizadas. Sprint Backlog con 12 items. Métricas definidas con indicadores de éxito.', status: SubmissionStatus.GRADED, score: 95, feedback: 'Trabajo excepcional. La priorización del backlog es muy clara. Las métricas son SMART. Considera incluir un burndown chart.', daysAgo: 10 },
  ]

  for (const s of submissionsData) {
    await db.submission.create({
      data: {
        assignmentId: s.assignmentId,
        studentId: s.studentId,
        content: s.content,
        status: s.status,
        score: s.score,
        feedback: s.feedback,
        submittedAt: ts(s.daysAgo),
        gradedAt: s.status === SubmissionStatus.GRADED ? ts(s.daysAgo - 1) : null,
      },
    })
    const user = Object.values(users).find(u => u.id === s.studentId)
    const assignment = assignments.find(a => a.id === s.assignmentId)
    console.log(`   ✔ ${user?.email} → "${assignment?.title}" [${s.status}]${s.score !== null ? ` (${s.score}pts)` : ''}`)
  }
  counts.submissions = submissionsData.length

  // ── 7. Announcements (2-3 per published course) ───────────────────
  console.log('\n📢 Creating announcements …')
  const announcementsData: { title: string; content: string; courseId: string; authorId: string; isPinned: boolean; daysAgo: number }[] = [
    // Course 1
    { title: '¡Bienvenidos al Curso!', content: 'Bienvenidos a "Introducción a la Programación". En este curso aprenderán los fundamentos esenciales de la programación desde cero. No se necesita experiencia previa. ¡Estoy emocionado de acompañarlos en este viaje!', courseId: course1.id, authorId: prof1.id, isPinned: true, daysAgo: 30 },
    { title: 'Recordatorio: Fecha de Entrega', content: 'Recuerden que la entrega del primer programa "Hola Mundo" es el próximo viernes. Pueden consultar las instrucciones detalladas en la sección de Asignaciones. No duden en preguntar si tienen dudas.', courseId: course1.id, authorId: prof1.id, isPinned: false, daysAgo: 7 },
    { title: 'Material Complementario', content: 'He subido material complementario sobre depuración de código en la sección de recursos adicionales. Les recomiendo revisarlo antes de la entrega de la calculadora.', courseId: course1.id, authorId: prof1.id, isPinned: false, daysAgo: 3 },
    // Course 2
    { title: 'Bienvenida al Curso de UX/UI', content: '¡Hola a todos! Bienvenidos al curso de Diseño UX/UI Fundamentals. Este semestre trabajaremos en proyectos reales y utilizaremos Figma como herramienta principal. Por favor, creen una cuenta gratuita en figma.com.', courseId: course2.id, authorId: prof1.id, isPinned: true, daysAgo: 28 },
    { title: 'Workshop: Prototipado en Vivo', content: 'Este viernes realizaremos un workshop de prototipado en vivo. Traigan sus laptops con Figma instalado. El workshop será de 2 horas y cubriremos transiciones y smart animate.', courseId: course2.id, authorId: prof1.id, isPinned: false, daysAgo: 5 },
    // Course 3
    { title: 'Inicio del Curso', content: 'Bienvenidos a Gestión de Proyectos. A lo largo del curso trabajaremos con metodologías ágiles y herramientas profesionales. Se requerirá trabajo en equipo para el proyecto final.', courseId: course3.id, authorId: prof2.id, isPinned: true, daysAgo: 25 },
    { title: 'Formación de Equipos', content: 'Para el proyecto final, deben formar equipos de 4-5 personas. La lista de equipos debe entregarse antes del próximo lunes. Se proporcionará una plantilla para la gestión del proyecto.', courseId: course3.id, authorId: prof2.id, isPinned: false, daysAgo: 10 },
    { title: 'Invitación Especial: Charla de PM', content: 'Tendremos una charla especial con la Directora de Proyectos de una empresa tech el próximo miércoles. Tema: "Lecciones aprendidas gestionando proyectos a escala". No se lo pierdan.', courseId: course3.id, authorId: prof2.id, isPinned: true, daysAgo: 2 },
  ]

  for (const a of announcementsData) {
    await db.announcement.create({
      data: {
        title: a.title,
        content: a.content,
        courseId: a.courseId,
        authorId: a.authorId,
        isPinned: a.isPinned,
        createdAt: ts(a.daysAgo),
      },
    })
    const course = publishedCourses.find(c => c.id === a.courseId)
    console.log(`   ✔ "${a.title}" → ${course?.title}${a.isPinned ? ' 📌' : ''}`)
  }
  counts.announcements = announcementsData.length

  // ── 8. Notifications ──────────────────────────────────────────────
  console.log('\n🔔 Creating notifications …')
  const notificationsData: { userId: string; title: string; message: string; type: NotificationType; isRead: boolean; link: string | null; daysAgo: number }[] = [
    // Student notifications
    { userId: student1.id, title: 'Calificación Recibida', message: 'Tu entrega de "Primer Programa: Hola Mundo" ha sido calificada con 92 puntos.', type: NotificationType.SUCCESS, isRead: true, link: '/assignments', daysAgo: 5 },
    { userId: student1.id, title: 'Nueva Asignación', message: 'Se ha publicado la asignación "Plan de Proyecto Sprint" en Gestión de Proyectos.', type: NotificationType.INFO, isRead: true, link: '/assignments', daysAgo: 15 },
    { userId: student1.id, title: 'Recordatorio de Entrega', message: 'La asignación "Calculadora Básica" vence en 3 días. ¡No olvides entregar!', type: NotificationType.WARNING, isRead: false, link: '/assignments', daysAgo: 0 },
    { userId: student1.id, title: 'Anuncio: Material Complementario', message: 'María García ha publicado nuevo material complementario en "Introducción a la Programación".', type: NotificationType.INFO, isRead: false, link: '/announcements', daysAgo: 3 },
    { userId: student2.id, title: 'Calificación Recibida', message: 'Tu entrega de "Primer Programa: Hola Mundo" ha sido calificada con 85 puntos.', type: NotificationType.SUCCESS, isRead: true, link: '/assignments', daysAgo: 6 },
    { userId: student2.id, title: 'Nuevo Anuncio', message: 'Taller de prototipado en vivo este viernes. Consulta los detalles en announcements.', type: NotificationType.INFO, isRead: false, link: '/announcements', daysAgo: 5 },
    { userId: student3.id, title: 'Bienvenida al Curso', message: 'Te has inscrito exitosamente en "Introducción a la Programación". ¡Comienza tu viaje de aprendizaje!', type: NotificationType.SUCCESS, isRead: true, link: '/my-courses', daysAgo: 14 },
    { userId: student3.id, title: 'Recordatorio de Entrega', message: 'La asignación "Primer Programa: Hola Mundo" vence pronto. Aún no has enviado tu entrega.', type: NotificationType.WARNING, isRead: false, link: '/assignments', daysAgo: 1 },
    // Professor notifications
    { userId: prof1.id, title: 'Nueva Entrega Recibida', message: 'Ana Martínez ha enviado su trabajo para "Calculadora Básica". Pendiente de calificación.', type: NotificationType.INFO, isRead: false, link: '/assignments', daysAgo: 1 },
    { userId: prof1.id, title: 'Nueva Entrega Recibida', message: 'Juan López ha enviado su trabajo para "Rediseño de App Móvil". Pendiente de calificación.', type: NotificationType.INFO, isRead: false, link: '/assignments', daysAgo: 2 },
    { userId: prof1.id, title: 'Inscripción', message: 'Laura Sánchez se ha inscrito en "Introducción a la Programación".', type: NotificationType.SUCCESS, isRead: true, link: '/courses', daysAgo: 14 },
    { userId: prof2.id, title: 'Nueva Entrega Recibida', message: 'Ana Martínez ha enviado su trabajo para "Plan de Proyecto Sprint". Pendiente de calificación.', type: NotificationType.INFO, isRead: true, link: '/assignments', daysAgo: 10 },
    { userId: prof2.id, title: 'Inscripciones', message: 'Se han inscrito 3 nuevos estudiantes en "Gestión de Proyectos".', type: NotificationType.SUCCESS, isRead: true, link: '/courses', daysAgo: 25 },
    // Admin notification
    { userId: admin.id, title: 'Sistema Inicializado', message: 'El sistema Elévate LMS ha sido inicializado correctamente con datos de prueba.', type: NotificationType.SUCCESS, isRead: true, link: '/dashboard', daysAgo: 30 },
    { userId: admin.id, title: 'Nuevo Registro', message: 'Un nuevo estudiante se ha registrado en la plataforma.', type: NotificationType.INFO, isRead: false, link: '/admin/users', daysAgo: 1 },
  ]

  for (const n of notificationsData) {
    await db.notification.create({
      data: {
        userId: n.userId,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        link: n.link,
        createdAt: ts(n.daysAgo),
      },
    })
  }
  counts.notifications = notificationsData.length
  console.log(`   ✔ ${notificationsData.length} notifications created`)

  // ── 9. Audit Log Entries ──────────────────────────────────────────
  console.log('\n📋 Creating audit log entries …')
  const auditData: { userId: string | null; action: string; entity: string; entityId: string | null; details: string; daysAgo: number }[] = [
    { userId: admin.id, action: 'USER_CREATE', entity: 'User', entityId: prof1.id, details: 'Created professor account: María García', daysAgo: 30 },
    { userId: admin.id, action: 'USER_CREATE', entity: 'User', entityId: prof2.id, details: 'Created professor account: Carlos Rodríguez', daysAgo: 30 },
    { userId: prof1.id, action: 'COURSE_CREATE', entity: 'Course', entityId: course1.id, details: 'Created course: Introducción a la Programación', daysAgo: 29 },
    { userId: prof1.id, action: 'COURSE_PUBLISH', entity: 'Course', entityId: course1.id, details: 'Published course: Introducción a la Programación', daysAgo: 28 },
    { userId: prof1.id, action: 'COURSE_CREATE', entity: 'Course', entityId: course2.id, details: 'Created course: Diseño UX/UI Fundamentals', daysAgo: 27 },
    { userId: prof1.id, action: 'COURSE_PUBLISH', entity: 'Course', entityId: course2.id, details: 'Published course: Diseño UX/UI Fundamentals', daysAgo: 26 },
    { userId: prof2.id, action: 'COURSE_CREATE', entity: 'Course', entityId: course3.id, details: 'Created course: Gestión de Proyectos', daysAgo: 25 },
    { userId: prof2.id, action: 'COURSE_PUBLISH', entity: 'Course', entityId: course3.id, details: 'Published course: Gestión de Proyectos', daysAgo: 24 },
    { userId: student1.id, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: null, details: 'Enrolled in Introducción a la Programación', daysAgo: 20 },
    { userId: student1.id, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: null, details: 'Enrolled in Diseño UX/UI Fundamentals', daysAgo: 18 },
    { userId: student1.id, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: null, details: 'Enrolled in Gestión de Proyectos', daysAgo: 15 },
    { userId: student2.id, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: null, details: 'Enrolled in Introducción a la Programación', daysAgo: 19 },
    { userId: student3.id, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: null, details: 'Enrolled in Introducción a la Programación', daysAgo: 14 },
    { userId: student1.id, action: 'SUBMISSION_CREATE', entity: 'Submission', entityId: null, details: 'Submitted assignment: Primer Programa: Hola Mundo', daysAgo: 5 },
    { userId: prof1.id, action: 'SUBMISSION_GRADE', entity: 'Submission', entityId: null, details: 'Graded submission for Ana Martínez - 92/100', daysAgo: 4 },
    { userId: admin.id, action: 'USER_UPDATE', entity: 'User', entityId: student2.id, details: 'Verified email for Juan López', daysAgo: 19 },
    { userId: prof1.id, action: 'MODULE_CREATE', entity: 'Module', entityId: null, details: 'Added module "Fundamentos de Programación" to course 1', daysAgo: 28 },
    { userId: prof2.id, action: 'ANNOUNCEMENT_CREATE', entity: 'Announcement', entityId: null, details: 'Published announcement in Gestión de Proyectos', daysAgo: 2 },
  ]

  for (const a of auditData) {
    await db.auditLog.create({
      data: {
        userId: a.userId,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        details: a.details,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: ts(a.daysAgo),
      },
    })
  }
  counts.auditLogs = auditData.length
  console.log(`   ✔ ${auditData.length} audit log entries created`)

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n${DELIM}`)
  console.log('✅ Seed completed successfully!\n')
  console.log('📊 Summary:')
  console.log(`   Users         : ${counts.users}`)
  console.log(`   Courses       : ${counts.courses}  (${publishedCourses.length} published, 1 draft)`)
  console.log(`   Modules       : ${counts.modules}`)
  console.log(`   Lessons       : ${counts.lessons}`)
  console.log(`   Assignments   : ${counts.assignments}`)
  console.log(`   Enrollments   : ${counts.enrollments}`)
  console.log(`   Submissions   : ${counts.submissions}`)
  console.log(`   Announcements : ${counts.announcements}`)
  console.log(`   Notifications : ${counts.notifications}`)
  console.log(`   Audit Logs    : ${counts.auditLogs}`)
  console.log(DELIM)
  console.log('\n🔑 Test Accounts:')
  console.log('   Admin    : admin@elevate-lms.com / Admin123456')
  console.log('   Prof 1   : prof1@elevate-lms.com / Prof123456')
  console.log('   Prof 2   : prof2@elevate-lms.com / Prof123456')
  console.log('   Student1 : student1@elevate-lms.com / Stud123456')
  console.log('   Student2 : student2@elevate-lms.com / Stud123456')
  console.log('   Student3 : student3@elevate-lms.com / Stud123456')
  console.log('')
}

main()
  .catch((err) => {
    console.error('\n❌ Seed failed:')
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
